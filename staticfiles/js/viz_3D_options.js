// <!-- ERROR POP-UP -->

window.addEventListener("error", (e) => {
  alert(e.message);
  $("#loading").hide();
});

window.addEventListener("unhandledrejection", function (event) {
  alert(event.promise); // [object Promise] - the promise that generated the error
  alert(
    "(1). Please check whether uploaded files are DICOM or not, (2). Check how many files did you upload before and if the number of uploaded files matches with select the number of inputs option or not, (3). To know more about the error press: CTRL + SHIFT + J "
  ); // Error: Whoops! - the unhandled error object
  $("#loading").hide();
  // location.reload();
});

// <!-- Screen Recorder -->

let start = document.getElementById("start"),
  stop = document.getElementById("stop"),
  shot = document.getElementById("shot"),
  mediaRecorder;

start.addEventListener("click", async function () {
  let stream = await recordScreen();
  let mimeType = "video/webm";
  mediaRecorder = createRecorder(stream, mimeType);
});

stop.addEventListener("click", function () {
  mediaRecorder.stop();
});

async function recordScreen() {
  return await navigator.mediaDevices.getDisplayMedia({
    audio: false,
    video: { mediaSource: "screen" },
  });
}

function createRecorder(stream, mimeType) {
  // the stream data is stored in this array
  let recordedChunks = [];

  const mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = function (e) {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };
  mediaRecorder.onstop = function () {
    saveFile(recordedChunks);
    recordedChunks = [];
  };
  mediaRecorder.start(200); // For every 200ms the stream data will be stored in a separate chunk.
  return mediaRecorder;
}

function saveFile(recordedChunks) {
  const blob = new Blob(recordedChunks, {
    type: "video/webm",
  });
  let filename = window.prompt("Enter file name"),
    downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = `${filename}.webm`;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  URL.revokeObjectURL(blob); // clear from memory
  document.body.removeChild(downloadLink);
}

// <!-- ScreenShot -->

function screenShot() {
  html2canvas(document.querySelector("#viewContainer")).then((canvas) => {
    var dataURL = canvas.toDataURL("image/png");
    var data = atob(dataURL.substring("data:image/png;base64,".length)),
      asArray = new Uint8Array(data.length);

    for (var i = 0, len = data.length; i < len; ++i) {
      asArray[i] = data.charCodeAt(i);
    }

    var blob = new Blob([asArray.buffer], { type: "image/png" });

    let filename = window.prompt("Enter file name"),
      downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${filename}.png`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    URL.revokeObjectURL(blob); // clear from memory
    document.body.removeChild(downloadLink);
  });
}
