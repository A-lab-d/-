// main.js
import { auth, db } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, orderBy, query, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";

let calendar;

// アプリの機能を初期化する関数
function initApp() {
    const user = auth.currentUser;
    if (!user) {
        console.error("ユーザーが認証されていません。");
        return;
    }

    // To Doリストの初期化
    initTodoList(user.uid);
    // カレンダーの初期化
    initCalendar(user.uid);

    // ログアウトボタン
    document.getElementById('logout-button').addEventListener('click', () => {
        auth.signOut();
    });
}

// To Doリスト機能の初期化
function initTodoList(uid) {
    const todoForm = document.getElementById('todo-form');
    const todoList = document.getElementById('todo-list');

    // タスクの追加
    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('todo-text').value;
        if (text.trim() === '') return;

        await addDoc(collection(db, `users/${uid}/todos`), {
            text: text,
            status: '検討中', // 初期ステータス
            createdAt: serverTimestamp()
        });
        document.getElementById('todo-text').value = '';
    });

    // To Doリストのリアルタイム表示
    const q = query(collection(db, `users/${uid}/todos`), orderBy('createdAt'));
    onSnapshot(q, snapshot => {
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

        // ステータス変更と削除のイベントリスナー
        todoList.querySelectorAll('.todo-status').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const currentStatus = e.target.dataset.status;
                const statuses = ['検討中', '実行中', '達成'];
                const newStatus = statuses[(statuses.indexOf(currentStatus) + 1) % statuses.length];

                await updateDoc(doc(db, `users/${uid}/todos`, id), {
                    status: newStatus
                });
            });
        });

        todoList.querySelectorAll('.delete-button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await deleteDoc(doc(db, `users/${uid}/todos`, id));
            });
        });
    });
}

// カレンダー機能の初期化
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
        eventClick: (info) => {
            if (confirm(`「${info.event.title}」を削除しますか？`)) {
                deleteDoc(doc(db, `users/${uid}/events`, info.event.id));
            }
        },
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                const snapshot = await getDocs(collection(db, `users/${uid}/events`));
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

    // 予定の追加
    const eventForm = document.getElementById('event-form');
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('event-title').value;
        const start = new Date(document.getElementById('event-start-date').value);
        const end = new Date(document.getElementById('event-end-date').value);

        if (title.trim() === '' || !start || !end || start >= end) {
            alert('入力内容を確認してください。');
            return;
        }

        await addDoc(collection(db, `users/${uid}/events`), {
            title: title,
            start: Timestamp.fromDate(start),
            end: Timestamp.fromDate(end)
        });

        document.getElementById('event-title').value = '';
        document.getElementById('event-start-date').value = '';
        document.getElementById('event-end-date').value = '';
        
        // カレンダーを再描画して最新のイベントを表示
        calendar.refetchEvents();
    });
}

// ページ読み込み時に認証状態をチェックし、ログイン済みならinitAppを呼び出す
auth.onAuthStateChanged(user => {
    if (user) {
        initApp();
    }
});