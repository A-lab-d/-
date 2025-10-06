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
    initDateInputUI();

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
        const title = document.getElementById('todo-title').value;
        const description = document.getElementById('todo-description').value;

        if (title.trim() === '') {
            alert('タスクのタイトルは必須です。');
            return;
        }

        await db.collection(`users/${uid}/todos`).add({
            title: title,
            description: description,
            status: INITIAL_STATUS,
            statusOrder: STATUS_ORDER_MAP[INITIAL_STATUS],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('todo-title').value = '';
        document.getElementById('todo-description').value = '';
    });
    
    db.collection(`users/${uid}/todos`)
        .orderBy('statusOrder')
        .orderBy('createdAt')
        .onSnapshot(snapshot => { 
        
        todoList.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.setAttribute('data-id', docSnap.id);
            
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
        
        todoList.querySelectorAll('.todo-description.editable').forEach(span => {
            span.addEventListener('click', function() {
                const currentText = this.textContent.trim() === '内容なし (クリックで編集)' ? '' : this.textContent.trim();
                const taskId = this.dataset.id;
                
                const input = document.createElement('textarea');
                input.value = currentText;
                input.rows = 3; 
                input.className = 'description-editor';

                this.style.display = 'none';
                this.parentNode.appendChild(input); 
                input.focus();

                const saveChanges = async () => {
                    const newDescription = input.value.trim();
                    await db.collection(`users/${uid}/todos`).doc(taskId).update({
                        description: newDescription
                    });
                    
                    input.remove();
                    this.style.display = 'block';
                };

                input.addEventListener('blur', saveChanges);
                
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
    
    assigneeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === '個人') {
                individualAssigneesDiv.style.display = 'grid';
            } else {
                individualAssigneesDiv.style.display = 'none';
            }
        });
    });
}

// --- 日付入力UIロジック（変更なし） ---
function initDateInputUI() {
    const singleInputDiv = document.getElementById('single-date-input');
    const rangeInputDiv = document.getElementById('range-date-input');
    const dateRadios = document.getElementsByName('dateType');
    
    dateRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'range') {
                singleInputDiv.style.display = 'none';
                rangeInputDiv.style.display = 'grid';
                
                document.getElementById('event-date').removeAttribute('required');
                document.getElementById('event-start-date').setAttribute('required', 'required');
                document.getElementById('event-end-date').setAttribute('required', 'required');
            } else {
                singleInputDiv.style.display = 'grid';
                rangeInputDiv.style.display = 'none';
                
                document.getElementById('event-date').setAttribute('required', 'required');
                document.getElementById('event-start-date').removeAttribute('required');
                document.getElementById('event-end-date').removeAttribute('required');
            }
        });
    });
    
    document.getElementById('event-date').setAttribute('required', 'required');
    document.getElementById('event-start-date').removeAttribute('required');
    document.getElementById('event-end-date').removeAttribute('required');
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
            showEventDetail(uid, info.event);
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
        const description = document.getElementById('event-description').value;
        const assigneeType = document.querySelector('input[name="assigneeType"]:checked').value;
        const dateType = document.querySelector('input[name="dateType"]:checked').value;
        
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

        let startDate, endDate;

        if (dateType === 'single') {
            startDate = document.getElementById('event-date').value;
            
            if (!startDate) {
                alert('日付を入力してください。');
                return;
            }
            
            const endDateObj = new Date(startDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            endDate = endDateObj.toISOString().split('T')[0];
            
        } else { // range
            startDate = document.getElementById('event-start-date').value;
            endDate = document.getElementById('event-end-date').value;
            
            if (!startDate || !endDate) {
                alert('開始日と終了日を入力してください。');
                return;
            }
            
            if (startDate > endDate) {
                alert('開始日は終了日よりも後の日付に設定できません。');
                return;
            }
            
            const endDateObj = new Date(endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            endDate = endDateObj.toISOString().split('T')[0];
        }


        if (title.trim() === '') {
            alert('タイトルを入力してください。');
            return;
        }
        
        await db.collection(`users/${uid}/events`).add({
            title: title,
            description: description,
            assignee: finalAssignee,
            start: startDate, 
            end: endDate,
            allDay: true
        });
        
        // フォームをクリア
        document.getElementById('event-title').value = '';
        document.getElementById('event-description').value = '';
        document.getElementById('event-date').value = '';
        document.getElementById('event-start-date').value = '';
        document.getElementById('event-end-date').value = '';
        document.getElementById('assignee-all').checked = true;
        document.getElementById('date-single').checked = true;
        document.getElementById('individual-assignees').style.display = 'none';
        document.getElementById('range-date-input').style.display = 'none';
        document.getElementById('single-date-input').style.display = 'grid';
        document.getElementById('assignee-1').value = '';
        document.getElementById('assignee-2').value = '';
        document.getElementById('assignee-3').value = '';
        document.getElementById('assignee-4').value = '';
        
        document.getElementById('event-date').setAttribute('required', 'required');
        document.getElementById('event-start-date').removeAttribute('required');
        document.getElementById('event-end-date').removeAttribute('required');

        calendar.refetchEvents();
    });
}

// --- イベント詳細表示/編集関数 ---
function showEventDetail(uid, event) {
    const modal = document.getElementById('event-detail-modal');
    const closeButton = modal.querySelector('.close-button');
    const deleteButton = document.getElementById('detail-delete-button');
    const saveButton = document.getElementById('detail-save-button');
    const assigneesDiv = document.getElementById('detail-individual-assignees');
    const assigneeRadios = document.getElementsByName('detailAssigneeType');
    
    // 期間編集用の要素
    const detailStartDateInput = document.getElementById('detail-start-date');
    const detailEndDateInput = document.getElementById('detail-end-date');

    // 担当者タイプ変更イベント（UI表示切替）を先に設定
    assigneeRadios.forEach(radio => {
        radio.onchange = (e) => {
            if (e.target.value === '個人') {
                assigneesDiv.style.display = 'grid';
            } else {
                assigneesDiv.style.display = 'none';
            }
        };
    });
    
    // イベントIDを保存
    document.getElementById('detail-event-id').value = event.id;

    // Firestoreから最新のデータを取得
    db.collection(`users/${uid}/events`).doc(event.id).get().then(doc => {
        if (!doc.exists) {
            alert('予定が見つかりませんでした。');
            modal.style.display = 'none';
            return;
        }
        const data = doc.data();
        
        // タイトルと内容を設定
        document.getElementById('detail-title').value = data.title;
        document.getElementById('detail-description').value = data.description || '';

        // 【修正】: 期間入力フィールドに値を設定
        // FullCalendarはendを+1日しているので、編集フィールドには-1日した日付を設定する
        const displayEndDate = new Date(data.end);
        displayEndDate.setDate(displayEndDate.getDate() - 1);
        
        detailStartDateInput.value = data.start;
        // 日付形式 YYYY-MM-DD に整形して設定
        detailEndDateInput.value = displayEndDate.toISOString().split('T')[0]; 
        
        // 担当者情報を設定
        const assigneeTypeAll = document.getElementById('detail-assignee-all');
        const assigneeTypeIndividual = document.getElementById('detail-assignee-individual');
        
        // 担当者入力フィールドをクリア
        for (let i = 1; i <= 4; i++) {
            document.getElementById(`detail-assignee-${i}`).value = '';
        }
        
        if (data.assignee === '全員') {
            assigneeTypeAll.checked = true;
            assigneesDiv.style.display = 'none';
        } else {
            assigneeTypeIndividual.checked = true;
            assigneesDiv.style.display = 'grid';
            
            if (Array.isArray(data.assignee)) {
                data.assignee.forEach((name, index) => {
                    if (index < 4) {
                        document.getElementById(`detail-assignee-${index + 1}`).value = name;
                    }
                });
            }
        }
        
        // モーダルを表示
        modal.style.display = 'block';
    }).catch(error => {
        console.error("予定データの取得エラー:", error);
        alert("予定の詳細を取得できませんでした。");
    });


    // --- モーダル内のイベントリスナー ---

    // 閉じるボタン
    closeButton.onclick = () => {
        modal.style.display = 'none';
    };

    // モーダルの外側をクリック
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // 削除ボタン
    deleteButton.onclick = async () => {
        if (confirm('この予定を本当に削除しますか？')) {
            const id = document.getElementById('detail-event-id').value;
            await db.collection(`users/${uid}/events`).doc(id).delete();
            modal.style.display = 'none';
            calendar.refetchEvents(); // カレンダーを更新
        }
    };
    
    // 【修正】: 保存ボタン
    saveButton.onclick = async () => {
        const id = document.getElementById('detail-event-id').value;
        const newTitle = document.getElementById('detail-title').value;
        const newDescription = document.getElementById('detail-description').value;
        
        // 【修正】: 新しい期間の値を取得
        const newStartDate = detailStartDateInput.value;
        const newEndDate = detailEndDateInput.value;
        
        const newAssigneeType = document.querySelector('input[name="detailAssigneeType"]:checked').value;
        
        let newFinalAssignee;
        
        if (newAssigneeType === '全員') {
            newFinalAssignee = '全員';
        } else {
            const individualNames = [];
            for (let i = 1; i <= 4; i++) {
                const name = document.getElementById(`detail-assignee-${i}`).value.trim();
                if (name) {
                    individualNames.push(name);
                }
            }
            
            if (individualNames.length === 0) {
                alert('個人を担当者にする場合、担当者は少なくとも1人入力してください。');
                return;
            }
            newFinalAssignee = individualNames;
        }
        
        // 【修正】: バリデーションチェック
        if (newTitle.trim() === '' || !newStartDate || !newEndDate) {
            alert('タイトルと期間を入力してください。');
            return;
        }
        if (newStartDate > newEndDate) {
            alert('開始日は終了日よりも後の日付に設定できません。');
            return;
        }

        // FullCalendarの仕様に合わせて終了日を翌日に設定
        const saveEndDateObj = new Date(newEndDate);
        saveEndDateObj.setDate(saveEndDateObj.getDate() + 1);
        const saveEndDate = saveEndDateObj.toISOString().split('T')[0];


        await db.collection(`users/${uid}/events`).doc(id).update({
            title: newTitle,
            description: newDescription,
            assignee: newFinalAssignee,
            start: newStartDate, // 【更新】
            end: saveEndDate     // 【更新】
        });
        
        alert('予定が更新されました。');
        modal.style.display = 'none';
        calendar.refetchEvents(); // カレンダーを更新
    };
}


// --- 認証ロジック（変更なし） ---
document.getElementById('email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const fixedPassword = 'secretpassword'; 
    auth.signInWithEmailAndPassword(email, fixedPassword)
        .then((userCredential) => {
            console.log("ログイン成功:", userCredential.user.email);
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
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
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        initApp();
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
    }
});
