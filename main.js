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
    initAssigneeUI(); 

    document.getElementById('logout-button').addEventListener('click', () => {
        auth.signOut();
    });
}

// --- To Doリスト機能（変更なし） ---
function initTodoList(uid) {
    const todoForm = document.getElementById('todo-form');
    const todoList = document.getElementById('todo-list');

    // 1. タスク追加処理の修正
    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('todo-title').value;
        const description = document.getElementById('todo-description').value;

        if (title.trim() === '') {
            alert('タスクのタイトルは必須です。');
            return;
        }

        await db.collection(`users/${uid}/todos`).add({
            title: title, // タイトルを保存
            description: description, // 内容を保存
            status: INITIAL_STATUS,
            statusOrder: STATUS_ORDER_MAP[INITIAL_STATUS],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('todo-title').value = '';
        document.getElementById('todo-description').value = '';
    });
    
    // 2. タスク一覧のリアルタイム表示とイベントリスナーの設定
    db.collection(`users/${uid}/todos`)
        .orderBy('statusOrder')
        .orderBy('createdAt')
        .onSnapshot(snapshot => { 
        
        todoList.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.setAttribute('data-id', docSnap.id); // liにIDを設定
            
            // 【修正】タイトルと内容を表示する新しい構造
            li.innerHTML = `
                <div class="todo-content">
                    <span class="todo-title">${data.title}</span>
                    <span class="todo-description editable" data-id="${docSnap.id}">
                        ${data.description || '内容なし (クリックで編集)'}
                    </span>
                </div>
                <div class="todo-actions">
                    <span class="todo-status status-${data.status}" data-id="${docSnap.id}" data-status="${data.status}">${data.status}</span>
                    <button class="delete-button" data-id="${docSnap.id}">x</button>
                </div>
            `;
            todoList.appendChild(li);
        });
        
        // 3. ステータス変更イベント
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
        
        // 4. 削除イベント
        todoList.querySelectorAll('.delete-button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await db.collection(`users/${uid}/todos`).doc(id).delete();
            });
        });
        
        // 5. 【新規追加】内容のインライン編集イベント
        todoList.querySelectorAll('.todo-description.editable').forEach(span => {
            span.addEventListener('click', function() {
                const currentText = this.textContent.trim() === '内容なし (クリックで編集)' ? '' : this.textContent.trim();
                const taskId = this.dataset.id;
                
                // テキストエリアを作成
                const input = document.createElement('textarea');
                input.value = currentText;
                input.rows = 3; 
                input.className = 'description-editor';

                // 編集中は表示を置き換える
                this.style.display = 'none';
                this.parentNode.appendChild(input); 
                input.focus();

                // 編集完了時の処理
                const saveChanges = async () => {
                    const newDescription = input.value.trim();
                    await db.collection(`users/${uid}/todos`).doc(taskId).update({
                        description: newDescription
                    });
                    
                    // 元の表示に戻す
                    input.remove();
                    this.style.display = 'block';
                };

                // フォーカスが外れたら保存 (Blur)
                input.addEventListener('blur', saveChanges);
                
                // Enterキー (Shift+Enterで改行可能) でも保存
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveChanges();
                    }
                });
            });
        });
    });
}

// --- 担当者UIロジック（変更なし） ---
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

// --- カレンダー機能（1日のみの予定を許可するよう修正） ---
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
                    
                    let assigneeDisplay;
                    if (Array.isArray(data.assignee)) {
                        assigneeDisplay = data.assignee.join(', ');
                    } else {
                        assigneeDisplay = data.assignee;
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
            finalAssignee = individualNames;
        }

        const startInput = document.getElementById('event-start-date').value;
        const endInput = document.getElementById('event-end-date').value;
        
        // 【修正1】: バリデーションを修正。開始日と終了日が入力されているか、開始日が終了日よりも前または同じであるかをチェック。
        if (title.trim() === '' || !startInput || !endInput) {
            alert('タイトルと日付を入力してください。');
            return;
        }

        if (startInput > endInput) {
            alert('開始日は終了日よりも後の日付に設定できません。');
            return;
        }
        
        // 【修正2】: FullCalendarの仕様（終了日を含まない）に合わせて、終了日が開始日と同じ場合は、終了日を翌日に設定するロジックを再確認し、そのまま維持。

        const endDate = new Date(endInput);
        // 終了日の日付オブジェクトを作成し、FullCalendarの仕様に合わせて1日加算
        endDate.setDate(endDate.getDate() + 1);
        const endDay = endDate.toISOString().split('T')[0];

        // FullCalendarの仕様により、開始日と終了日が同じ日であっても
        // (例: 2025-09-26 to 2025-09-26)
        // データベースには終了日として翌日 (2025-09-27) が保存され、
        // カレンダー上では正しく1日のみの予定として表示されます。
        
        await db.collection(`users/${uid}/events`).add({
            title: title,
            assignee: finalAssignee,
            start: startInput, 
            end: endDay, // 終了日（FullCalendarの仕様に合わせて翌日）を保存
            allDay: true
        });
        
        // フォームをクリア
        document.getElementById('event-title').value = '';
        document.getElementById('event-start-date').value = '';
        document.getElementById('event-end-date').value = '';
        document.getElementById('assignee-all').checked = true;
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
