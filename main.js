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
    // 【新規追加】: タグ管理機能を初期化
    initTagManagement(user.uid); 

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

// --- 担当者タグ管理機能（新規追加） ---
function initTagManagement(uid) {
    const tagForm = document.getElementById('tag-form');
    const tagList = document.getElementById('tag-list');
    const eventAssigneeSelect = document.getElementById('event-assignee');
    const tagsCollection = db.collection(`users/${uid}/tags`);

    // タグの追加
    tagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tagName = document.getElementById('new-tag-name').value.trim();
        if (tagName === '') return;

        await tagsCollection.add({
            name: tagName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('new-tag-name').value = '';
    });

    // タグのリアルタイム表示とカレンダー選択肢への反映
    tagsCollection.orderBy('createdAt').onSnapshot(snapshot => {
        tagList.innerHTML = '';
        
        // 【カレンダー選択肢の初期化】: 「全員」オプションを保持
        const currentOptions = Array.from(eventAssigneeSelect.options);
        eventAssigneeSelect.innerHTML = '';
        eventAssigneeSelect.appendChild(currentOptions[0]); // 「全員」を最初に追加

        snapshot.forEach(docSnap => {
            const tagName = docSnap.data().name;

            // 1. タグ管理リストの更新
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${tagName}</span>
                <button class="delete-tag-button" data-id="${docSnap.id}">x</button>
            `;
            tagList.appendChild(li);

            // 2. カレンダー担当者選択肢の更新
            const option = document.createElement('option');
            option.value = tagName;
            option.textContent = tagName;
            eventAssigneeSelect.appendChild(option);
        });

        // タグ削除イベントリスナー
        tagList.querySelectorAll('.delete-tag-button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await tagsCollection.doc(id).delete();
            });
        });
    });
}

// --- カレンダー機能（担当者欄のデータ送信を修正） ---
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
                    // イベントタイトルに担当者名を追加して表示
                    const displayTitle = `${data.title} (${data.assignee})`;
                    events.push({
                        id: docSnap.id,
                        title: displayTitle,
                        start: data.start, 
                        end: data.end,
                        allDay: true
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
        const assignee = document.getElementById('event-assignee').value; // 【追加】担当者名を取得
        
        const startInput = document.getElementById('event-start-date').value;
        const endInput = document.getElementById('event-end-date').value;
        
        const endDate = new Date(endInput);
        endDate.setDate(endDate.getDate() + 1);
        const endDay = endDate.toISOString().split('T')[0];

        if (title.trim() === '' || !startInput || !endInput || startInput >= endInput) {
            alert('入力内容を確認してください。');
            return;
        }
        
        await db.collection(`users/${uid}/events`).add({
            title: title,
            assignee: assignee, // 【追加】担当者名を保存
            start: startInput, 
            end: endDay,
            allDay: true
        });
        
        // フォームをクリア
        document.getElementById('event-title').value = '';
        document.getElementById('event-start-date').value = '';
        document.getElementById('event-end-date').value = '';
        document.getElementById('event-assignee').value = '全員'; // デフォルトに戻す
        
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
