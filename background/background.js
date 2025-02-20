chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    console.log("新書籤已新增: ", bookmark);
});
chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    console.log("書籤已刪除: ", id);
});
