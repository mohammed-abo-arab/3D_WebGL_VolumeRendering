// file name cacheManager.js //
const db = new Dexie("MyDatabase");
db.version(1).stores({
  files: "++id, name, type, blob, timestamp",
});

function cacheFile(file) {
  const reader = new FileReader();
  reader.onload = async function (event) {
    await cleanUpOldFiles(); // Clean up old files before adding a new one
    await db.files.add({
      name: file.name,
      type: file.type,
      blob: new Blob([event.target.result], { type: file.type }),
      timestamp: new Date().getTime(), // Current timestamp
    });
  };
  reader.readAsArrayBuffer(file);
}

async function cleanUpOldFiles() {
  const thirtyDaysAgo = new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
  await db.files.where("timestamp").below(thirtyDaysAgo).delete();
}

// Ensure cleanUpOldFiles is called every time the site is loaded or reloaded
document.addEventListener("DOMContentLoaded", cleanUpOldFiles);

// Add event listener for file upload input
document
  .getElementById("btn1")
  .addEventListener("change", async function (event) {
    const files = event.target.files;
    await cleanUpOldFiles(); // Optionally, clean up old files again before processing new files
    for (const file of files) {
      await cacheFile(file);
    }
  });
