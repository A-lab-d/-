// main.js

// firebase-config.jsでグローバル変数として定義された auth と db をそのまま使用

let calendar;

// ステータスとソート順の対応を定義
const STATUS_ORDER_MAP = {
    '実行中': 1,
    '検討中': 2,
    '達成': 3
};
const INITIAL_STATUS = '検討中';

// アプリの機能を初期化する関数
function initApp() {
    const user = auth.currentUser;
    if (!user) {
        console.error("ユーザーが認証されていません。");
        return;
    }
    
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

// --- カレンダー機能（日付のみに修正） ---
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
        // 【修正】: 全日イベント（時刻なし）として扱う
        allDay: true,
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
                        // 【修正】: toDate()ではなく、Firestoreから取得した日付文字列を直接使用
                        start: data.start, 
                        end: data.end,
                        allDay: true // 全日イベントとして扱う
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
        
        // 【修正】: 日付入力のIDを使用
        const startInput = document.getElementById('event-start-date').value;
        const endInput = document.getElementById('event-end-date').value; // 終了日は含まれない日として登録するため
        
        // 終了日はFullCalendarの仕様に合わせ、入力された日付の翌日を終了日とする
        const endDate = new Date(endInput);
        endDate.setDate(endDate.getDate() + 1); // 翌日に設定
        const endDay = endDate.toISOString().split('T')[0]; // YYYY-MM-DD 形式に戻す

        if (title.trim() === '' || !startInput || !endInput || startInput >= endInput) {
            alert('入力内容を確認してください。');
            return;
        }
        
        await db.collection(`users/${uid}/events`).add({
            title: title,
            // 【修正】: YYYY-MM-DD形式の文字列をそのまま保存
            start: startInput, 
            end: endDay, // FullCalendarは終了日を含まない仕様
            allDay: true
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
