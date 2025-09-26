// main.js

// firebase-config.jsでグローバル変数として定義された auth と db をそのまま使用

let calendar;

// ステータスとソート順の対応を定義
const STATUS_ORDER_MAP = {
    '実行中': 1, // 最優先
    '検討中': 2,
    '達成': 3     // 最低優先
};
const INITIAL_STATUS = '検討中';

// アプリの機能を初期化する関数
function initApp() {
    const user = auth.currentUser;
    if (!user) {
        console.error("ユーザーが認証されていません。");
        return;
    }
    
    // 不要なカスタム時間生成ロジックを削除したため、これで正常に動作する
    initTodoList(user.uid);
    initCalendar(user.uid);

    document.getElementById('logout-button').addEventListener('click', () => {
        auth.signOut();
    });
}

// --- To Doリスト機能（変更なし） ---
function initTodoList(uid) {
    const todoForm = document.getElementById('todo-form');
    const todoList = document.getElementById('todo-list');

    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('todo-text').value;
        if (text.trim() === '') return;
        await db.collection(`users/${uid}/todos`).add({
            text: text,
            status: INITIAL_STATUS,
            statusOrder: STATUS_ORDER_MAP[INITIAL_STATUS],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('todo-text').value = '';
    });
    
    db.collection(`users/${uid}/todos`)
        .orderBy('statusOrder')
        .orderBy('createdAt')
        .onSnapshot(snapshot => { 
        
        todoList.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${data.text}</span>
                <span class="todo-status status-${data.status}" data-id="${docSnap.id}" data-status="${data.status}">${data.status}</span>
                <button class="delete-button" data-id="${docSnap.id}">x</button>
            `;
            todoList.appendChild(li);
        });
        
        todoList.querySelectorAll('.todo-status').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const currentStatus = e.target.dataset.status;
                const statuses = ['検討中', '実行中', '達成'];
                
                const nextStatusIndex = (statuses.indexOf(currentStatus) + 1) % statuses.length;
                const newStatus = statuses[nextStatusIndex];
                
                const newStatusOrder = STATUS_ORDER_MAP[newStatus];

                await db.collection(`users/${uid}/todos`).doc(id).update({
                    status: newStatus,
                    statusOrder: newStatusOrder
                });
            });
        });
        
        todoList.querySelectorAll('.delete-button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await db.collection(`users/${uid}/todos`).doc(id).delete();
            });
        });
    });
}

// --- カレンダー機能 ---
function initCalendar(uid) {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        editable: true,
        selectable: true,
        eventClick: async (info) => {
            if (confirm(`「${info.event.title}」を削除しますか？`)) {
                await db.collection(`users/${uid}/events`).doc(info.event.id).delete();
                calendar.refetchEvents();
            }
        },
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                const snapshot = await db.collection(`users/${uid}/events`).get();
                const events = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    events.push({
                        id: docSnap.id,
                        title: data.title,
                        start: data.start.toDate(),
                        end: data.end.toDate()
                    });
                });
                successCallback(events);
            } catch (error) {
                failureCallback(error);
            }
        }
    });
    calendar.render();
    const eventForm = document.getElementById('event-form');
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('event-title').value;
        
        // datetime-local の IDに戻す
        const startInput = document.getElementById('event-start-date').value;
        const endInput = document.getElementById('event-end-date').value;

        // datetime-local の値は ISO 8601 形式なので、そのまま Date に変換できる
        const start = new Date(startInput);
        const end = new Date(endInput);

        if (title.trim() === '' || !startInput || !endInput || start >= end) {
            alert('入力内容を確認してください。');
            return;
        }
        await db.collection(`users/${uid}/events`).add({
            title: title,
            start: firebase.firestore.Timestamp.fromDate(start),
            end: firebase.firestore.Timestamp.fromDate(end)
        });
        
        // フォームをクリア
        document.getElementById('event-title').value = '';
        document.getElementById('event-start-date').value = '';
        document.getElementById('event-end-date').value = '';
        
        calendar.refetchEvents();
    });
}

// --- 認証ロジック（変更なし） ---
document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const fixedPassword = 'secretpassword'; 
    auth.signInWithEmailAndPassword(email, fixedPassword)
        .then((userCredential) => {
            console.log("ログイン成功:", userCredential.user.email);
            initApp();
        })
        .catch(error => {
            alert("ログインに失敗しました。メールアドレスまたはパスワードが正しくありません。");
            console.error(error);
        });
});

// ページ読み込み時に認証状態をチェックし、ログイン済みならinitAppを呼び出す
auth.onAuthStateChanged(user => {
    if (user) {
        initApp();
    }
});
