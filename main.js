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
    // 【新規追加】: 担当者UIロジックを初期化
    initAssigneeUI(); 

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

// --- 担当者UIロジック（新規追加） ---
function initAssigneeUI() {
    const individualAssigneesDiv = document.getElementById('individual-assignees');
    const assigneeRadios = document.getElementsByName('assigneeType');
    
    // ラジオボタンの変更を監視し、個人入力欄の表示/非表示を切り替える
    assigneeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === '個人') {
                individualAssigneesDiv.style.display = 'grid'; // CSS Gridで表示
            } else {
                individualAssigneesDiv.style.display = 'none';
            }
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
                    
                    // 担当者データが配列か文字列かを判断し、表示を整形
                    let assigneeDisplay;
                    if (Array.isArray(data.assignee)) {
                        assigneeDisplay = data.assignee.join(', '); // 個人リストをカンマ区切りに
                    } else {
                        assigneeDisplay = data.assignee; // 「全員」など
                    }

                    const displayTitle = `${data.title} (${assigneeDisplay})`;
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
        const assigneeType = document.querySelector('input[name="assigneeType"]:checked').value;
        
        let finalAssignee;
        
        if (assigneeType === '全員') {
            finalAssignee = '全員';
        } else {
            // 個人入力欄から値を取得し、空でないものだけをフィルタリング
            const individualNames = [];
            for (let i = 1; i <= 4; i++) {
                const name = document.getElementById(`assignee-${i}`).value.trim();
                if (name) {
                    individualNames.push(name);
                }
            }
            
            if (individualNames.length === 0) {
                alert('個人を担当者にする場合、担当者は少なくとも1人入力してください。');
                return;
            }
            finalAssignee = individualNames; // 配列として保存
        }

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
            assignee: finalAssignee, // 配列または文字列を保存
            start: startInput, 
            end: endDay,
            allDay: true
        });
        
        // フォームをクリア
        document.getElementById('event-title').value = '';
        document.getElementById('event-start-date').value = '';
        document.getElementById('event-end-date').value = '';
        document.getElementById('assignee-all').checked = true; // デフォルトに戻す
        document.getElementById('individual-assignees').style.display = 'none';
        document.getElementById('assignee-1').value = '';
        document.getElementById('assignee-2').value = '';
        document.getElementById('assignee-3').value = '';
        document.getElementById('assignee-4').value = '';
        
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
