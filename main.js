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

    initTodoList(user.uid);
    initCalendar(user.uid);

    document.getElementById('logout-button').addEventListener('click', () => {
        auth.signOut();
    });
}

// To Doリスト機能とカレンダー機能のコードはそのまま

// --- To Doリスト機能（変更なし） ---
function initTodoList(uid) {
    const todoForm = document.getElementById('todo-form');
    const todoList = document.getElementById('todo-list');

    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('todo-text').value;
        if (text.trim() === '') return;
        await addDoc(collection(db, `users/${uid}/todos`), {
            text: text,
            status: '検討中',
            createdAt: serverTimestamp()
        });
        document.getElementById('todo-text').value = '';
    });
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

// --- カレンダー機能（変更なし） ---
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
        calendar.refetchEvents();
    });
}

// --- 認証ロジック ---
// メールアドレス入力フォームの処理
document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    // 任意の固定パスワード
    const fixedPassword = 'secretpassword'; 

    // Firebaseの認証を実行
    auth.signInWithEmailAndPassword(email, fixedPassword)
        .then((userCredential) => {
            console.log("ログイン成功:", userCredential.user.email);
            // ログイン成功後にアプリを初期化
            initApp();
        })
        .catch(error => {
            alert("ログインに失敗しました。メールアドレスを確認してください。");
            console.error(error);
        });
});

// ページ読み込み時に認証状態をチェックし、ログイン済みならinitAppを呼び出す
auth.onAuthStateChanged(user => {
    if (user) {
        initApp();
    }
});
