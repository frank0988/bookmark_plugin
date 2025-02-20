document.addEventListener("DOMContentLoaded", () => {
    loadCategories();
    loadViewMode(); // 讀取上次選擇的視圖模式
    loadEditMode(); // 讀取上次選擇的編輯模式

    const newCategoryInput = document.getElementById("new-category");
    const addCategoryButton = document.getElementById("add-category");
    const toggleViewButton = document.getElementById("toggle-view");
    const toggleEditButton = document.getElementById("toggle-edit"); // 取得編輯模式按鈕

    addCategoryButton.addEventListener("click", () => {
        let category = newCategoryInput.value.trim();
        if (category) {
            addCategory(category);
            newCategoryInput.value = ""; // 清空輸入框
        }
    });

    toggleViewButton.addEventListener("click", toggleViewMode);
    toggleEditButton.addEventListener("click", toggleEditMode); // 確保事件綁定
});


// 讀取分類
function loadCategories() {
    chrome.storage.sync.get("categories", (data) => {
        console.log("從 storage 讀取到的 categories:", data.categories);

        let categories = data.categories;

        // 確保 categories 是陣列，否則初始化
        if (!Array.isArray(categories)) {
            console.error("categories 不是陣列，修正為預設值");
            categories = ["未分類"];
        }

        console.log("使用後的 categories:", categories);
        updateCategoryTabs(categories); // 更新 UI
    });
}

// 更新分類標籤（支援 favicon & 刪除按鈕）
function updateCategoryTabs(categories) {
    console.log("updateCategoryTabs 接收到的 categories:", categories);

    if (!Array.isArray(categories)) {
        console.error("categories 不是陣列，強制轉換:", categories);
        categories = ["未分類"]; // 強制轉換
    }

    const tabsContainer = document.getElementById("tabs-container");
    tabsContainer.innerHTML = ""; // 清空標籤

    categories.forEach(category => {
        let tab = document.createElement("button");
        tab.classList.add("tab-button");
        tab.dataset.category = category;

        let textNode = document.createTextNode(category);
        tab.appendChild(textNode);

        // 刪除分類按鈕
        if (category !== "未分類") {
            let deleteButton = document.createElement("button");
            deleteButton.textContent = "×";
            deleteButton.classList.add("delete-category");
            deleteButton.onclick = () => deleteCategory(category);
            tab.appendChild(deleteButton);
        }

        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab-button").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            loadBookmarks(category);
        });

        tabsContainer.appendChild(tab);
    });

    // 預設選擇第一個分類
    if (categories.length > 0) {
        tabsContainer.children[0].classList.add("active");
        loadBookmarks(categories[0]);
    }
}


// 新增分類
function addCategory(category) {
    chrome.storage.sync.get("categories", (data) => {
        let categories = Array.isArray(data.categories) ? data.categories : ["未分類"];

        if (!categories.includes(category)) {
            categories.push(category);
            chrome.storage.sync.set({ "categories": categories }, () => {
                console.log("分類已更新:", categories);
                updateCategoryTabs(categories); // 立即更新 UI
            });
        } else {
            alert("分類已存在！");
        }
    });
}

// 刪除分類（書籤移到「未分類」）
function deleteCategory(category) {
    chrome.storage.sync.get(["categories", "bookmarkCategories"], (data) => {
        let categories = Array.isArray(data.categories) ? data.categories : ["未分類"];
        let bookmarkCategories = data.bookmarkCategories || {};

        // 移除該分類
        categories = categories.filter(c => c !== category);

        // 將該分類內的書籤移到「未分類」
        Object.keys(bookmarkCategories).forEach(bookmarkId => {
            if (bookmarkCategories[bookmarkId] === category) {
                bookmarkCategories[bookmarkId] = "未分類";
            }
        });

        chrome.storage.sync.set({ "categories": categories, "bookmarkCategories": bookmarkCategories }, () => {
            updateCategoryTabs(categories);
            loadBookmarks("未分類"); // 確保刪除分類後顯示「未分類」的書籤
        });
    });
}

// 根據分類載入書籤
function loadBookmarks(category) {
    chrome.storage.sync.get("bookmarkCategories", (data) => {
        let bookmarkCategories = data.bookmarkCategories || {};

        chrome.bookmarks.getTree((tree) => {
            let bookmarks = extractBookmarks(tree, category, bookmarkCategories);
            displayBookmarks(bookmarks, category);
        });
    });
}

// 過濾書籤（根據 `bookmarkCategories` 儲存的分類）
function extractBookmarks(tree, category, bookmarkCategories) {
    let bookmarks = [];

    function traverse(node) {
        if (node.children) {
            node.children.forEach(traverse);
        } else if (node.url) {
            let assignedCategory = bookmarkCategories[node.id] || "未分類";
            if (assignedCategory === category) {
                bookmarks.push({ title: node.title, url: node.url, id: node.id });
            }
        }
    }

    tree.forEach(traverse);
    return bookmarks;
}

// 顯示書籤列表
function displayBookmarks(bookmarks, currentCategory) {
    const bookmarksList = document.getElementById("bookmarks-list");
    bookmarksList.innerHTML = "";

    chrome.storage.sync.get(["viewMode", "editMode"], (data) => {
        let isGridMode = data.viewMode === "grid";
        let isEditing = data.editMode;

        bookmarks.forEach(bookmark => {
            let item = document.createElement("div");
            item.classList.add("bookmark-item");
            item.draggable = isEditing;
            item.dataset.id = bookmark.id;
            item.style.cursor = isEditing ? "grab" : "pointer";

            // **取得 favicon**
            let domain = new URL(bookmark.url).hostname;
            let googleFaviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
            let fallbackFaviconUrl = `https://${domain}/favicon.ico`;

            let faviconImg = document.createElement("img");
            faviconImg.src = googleFaviconUrl;
            faviconImg.alt = "網站圖示";
            faviconImg.classList.add("favicon");

            faviconImg.onerror = function () {
                this.onerror = null;
                this.src = fallbackFaviconUrl;
            };

            // **標題名稱**
            let titleSpan = document.createElement("span");
            titleSpan.textContent = bookmark.title;

            // **移動按鈕**
            let moveButton = document.createElement("button");
            moveButton.textContent = "移動";
            moveButton.classList.add("move-button");
            moveButton.onclick = () => moveBookmark(bookmark.id, currentCategory);

            // **根據視圖模式調整 UI**
            if (isGridMode) {
                item.appendChild(faviconImg);
                item.appendChild(titleSpan); // ✅ 只在 icon 下方顯示標題
                item.appendChild(moveButton);
            } else {
                item.style.display = "flex";
                item.style.alignItems = "center";
                item.appendChild(faviconImg);
                item.appendChild(titleSpan);
                item.appendChild(moveButton);
            }

            bookmarksList.appendChild(item);
        });

        if (isEditing) enableDragAndDrop();
        else disableDragAndDrop();
    });
}




function deleteBookmark(bookmarkId) {
    chrome.bookmarks.remove(bookmarkId, () => {
        console.log(`書籤 ${bookmarkId} 已刪除`);
        loadCategories();
    });
}



function moveBookmark(bookmarkId, currentCategory, categories) {
    let newCategory = prompt(`移動書籤到哪個分類？可選分類：\n${categories.join(", ")}`, currentCategory);

    if (!newCategory || !categories.includes(newCategory)) {
        alert("請輸入有效的分類名稱！");
        return;
    }

    chrome.storage.sync.get("bookmarkCategories", (data) => {
        let bookmarkCategories = data.bookmarkCategories || {};

        // 更新書籤分類
        bookmarkCategories[bookmarkId] = newCategory;

        chrome.storage.sync.set({ "bookmarkCategories": bookmarkCategories }, () => {
            console.log(`書籤 ${bookmarkId} 已移動到分類 ${newCategory}`);
            loadBookmarks(currentCategory); // 重新載入 UI
        });
    });
}
function toggleViewMode() {
    chrome.storage.sync.get("viewMode", (data) => {
        let newMode = data.viewMode === "grid" ? "list" : "grid";
        chrome.storage.sync.set({ "viewMode": newMode }, () => {
            updateViewMode(newMode);
        });
    });
}

// 讀取使用者上次選擇的視圖模式
function loadViewMode() {
    chrome.storage.sync.get("viewMode", (data) => {
        let mode = data.viewMode || "list"; // 預設為列表模式
        updateViewMode(mode);
    });
}

// 更新視圖模式
function updateViewMode(mode) {
    const bookmarksList = document.getElementById("bookmarks-list");
    const toggleViewButton = document.getElementById("toggle-view");

    if (mode === "grid") {
        bookmarksList.classList.add("grid-mode");
        toggleViewButton.textContent = "切換為列表模式";
    } else {
        bookmarksList.classList.remove("grid-mode");
        toggleViewButton.textContent = "切換為網格模式";
    }
}
function enableDragAndDrop() {
    const items = document.querySelectorAll(".draggable");
    let draggingItem = null;

    items.forEach(item => {
        item.addEventListener("dragstart", (e) => {
            draggingItem = item;
            e.dataTransfer.setData("text/plain", item.dataset.id);
            setTimeout(() => item.style.opacity = "0.5", 0);
        });

        item.addEventListener("dragover", (e) => {
            e.preventDefault();
        });

        item.addEventListener("drop", (e) => {
            e.preventDefault();
            if (draggingItem !== item) {
                let parent = item.parentNode;
                parent.insertBefore(draggingItem, item);
                saveNewOrder();
            }
        });

        item.addEventListener("dragend", () => {
            draggingItem.style.opacity = "1";
            draggingItem = null;
        });
    });
}

// 儲存新的排序
function saveNewOrder() {
    let newOrder = [];
    document.querySelectorAll(".bookmark-item").forEach(item => {
        newOrder.push(item.dataset.id);
    });

    chrome.storage.sync.set({ "bookmarkOrder": newOrder }, () => {
        console.log("書籤排序已更新", newOrder);
    });
}

// 禁用拖動功能
function disableDragAndDrop() {
    document.querySelectorAll(".draggable").forEach(item => {
        item.draggable = false;
    });
}
// 讀取使用者上次選擇的編輯模式
function loadEditMode() {
    chrome.storage.sync.get("editMode", (data) => {
        let mode = data.editMode || false; // 預設為關閉
        updateEditMode(mode);
    });
}

// 更新 UI：啟用或關閉編輯模式
function updateEditMode(isEditing) {
    const bookmarksList = document.getElementById("bookmarks-list");
    const tabsContainer = document.getElementById("tabs-container");
    const toggleEditButton = document.getElementById("toggle-edit");

    if (isEditing) {
        bookmarksList.classList.add("edit-mode");
        tabsContainer.classList.add("edit-mode");
        toggleEditButton.textContent = "退出編輯模式";
        enableDragAndDrop(); // 啟用拖動功能
    } else {
        bookmarksList.classList.remove("edit-mode");
        tabsContainer.classList.remove("edit-mode");
        toggleEditButton.textContent = "編輯模式";
        disableDragAndDrop(); // 禁用拖動功能
    }

    // **控制書籤的 delete 按鈕**
    document.querySelectorAll(".delete-button").forEach(button => {
        button.style.display = isEditing ? "inline-block" : "none";
    });

    // **控制分類的 delete 按鈕**
    document.querySelectorAll(".delete-category").forEach(button => {
        button.style.display = isEditing ? "inline-block" : "none";
    });

    // **控制書籤拖動**
    document.querySelectorAll(".bookmark-item").forEach(item => {
        item.draggable = isEditing;
        item.style.cursor = isEditing ? "grab" : "pointer";
    });

    // **控制分類拖動**
    document.querySelectorAll(".tab-button").forEach(tab => {
        tab.draggable = isEditing;
        tab.style.cursor = isEditing ? "grab" : "pointer";
    });
}


// 切換編輯模式
function toggleEditMode() {
    chrome.storage.sync.get("editMode", (data) => {
        let newMode = !data.editMode;
        chrome.storage.sync.set({ "editMode": newMode }, () => {
            updateEditMode(newMode);
        });
    });
}
function enableDragAndDrop() {
    const bookmarkItems = document.querySelectorAll(".bookmark-item");
    const tabButtons = document.querySelectorAll(".tab-button");
    let draggingItem = null;

    // 書籤拖動
    bookmarkItems.forEach(item => {
        item.addEventListener("dragstart", (e) => {
            draggingItem = item;
            e.dataTransfer.setData("text/plain", item.dataset.id);
            setTimeout(() => item.style.opacity = "0.5", 0);
        });

        item.addEventListener("dragover", (e) => {
            e.preventDefault();
        });

        item.addEventListener("drop", (e) => {
            e.preventDefault();
            if (draggingItem !== item) {
                let parent = item.parentNode;
                parent.insertBefore(draggingItem, item);
                saveNewOrder("bookmarks");
            }
        });

        item.addEventListener("dragend", () => {
            draggingItem.style.opacity = "1";
            draggingItem = null;
        });
    });

    // 分類拖動
    tabButtons.forEach(tab => {
        tab.addEventListener("dragstart", (e) => {
            draggingItem = tab;
            e.dataTransfer.setData("text/plain", tab.dataset.category);
            setTimeout(() => tab.style.opacity = "0.5", 0);
        });

        tab.addEventListener("dragover", (e) => {
            e.preventDefault();
        });

        tab.addEventListener("drop", (e) => {
            e.preventDefault();
            if (draggingItem !== tab) {
                let parent = tab.parentNode;
                parent.insertBefore(draggingItem, tab);
                saveNewOrder("categories");
            }
        });

        tab.addEventListener("dragend", () => {
            draggingItem.style.opacity = "1";
            draggingItem = null;
        });
    });
}

// 儲存新的排序
function saveNewOrder(type) {
    let newOrder = [];
    if (type === "bookmarks") {
        document.querySelectorAll(".bookmark-item").forEach(item => {
            newOrder.push(item.dataset.id);
        });
        chrome.storage.sync.set({ "bookmarkOrder": newOrder }, () => {
            console.log("書籤排序已更新", newOrder);
        });
    } else if (type === "categories") {
        document.querySelectorAll(".tab-button").forEach(tab => {
            newOrder.push(tab.dataset.category);
        });
        chrome.storage.sync.set({ "categoryOrder": newOrder }, () => {
            console.log("分類排序已更新", newOrder);
        });
    }
}

// 禁用拖動功能
function disableDragAndDrop() {
    document.querySelectorAll(".bookmark-item").forEach(item => {
        item.draggable = false;
        item.style.cursor = "pointer";
    });

    document.querySelectorAll(".tab-button").forEach(tab => {
        tab.draggable = false;
        tab.style.cursor = "pointer";
    });
}
