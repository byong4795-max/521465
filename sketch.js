let peer;
let myId;
let video; // 手機端是本地相機，電腦端是接收到的遠端影像
let facemesh;
let predictions = [];
let isPhone = false;
let remoteStreamReady = false;
let connectionStatus = "初始化中..."; // Added for status display
let peerError = null; // Added for error display

function setup() {
  createCanvas(windowWidth, windowHeight);

  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');

  // 建立 PeerJS 物件，加入明確的 STUN 伺服器配置以利跨網路連線
  const peerConfig = {
    config: {
      'iceServers': [
        { url: 'stun:stun.l.google.com:19302' },
        { url: 'stun:stun1.l.google.com:19302' }
      ]
    }
  };

  if (room) {
    // 手機端模式
    isPhone = true;
    connectionStatus = "請求相機權限...";
    video = createCapture(VIDEO, (stream) => {
      connectionStatus = "正在建立通訊伺服器連線...";
      peer = new Peer(peerConfig);
      peer.on('open', (id) => {
        myId = id; // Store phone's ID too
        peer.call(room, stream); // 撥號給電腦
        connectionStatus = "正在連線至電腦端...";
      });
      peer.on('error', (err) => {
        console.error("PeerJS Error (Phone):", err);
        peerError = err.type;
        connectionStatus = "連線失敗: " + err.type;
      });
      peer.on('close', () => {
        connectionStatus = "連線已關閉 (Phone)";
      });
    }, (err) => { // Error callback for createCapture
      console.error("Camera access error (Phone):", err);
      connectionStatus = "無法存取相機: " + err.name;
    });
    video.size(640, 480);
    video.hide();
  } else {
    // 電腦端模式
    peer = new Peer(peerConfig);
    peer.on('open', (id) => {
      myId = id;
      connectionStatus = "等待手機連線...";
      if (typeof updateQRCode === 'function') updateQRCode(id);
    });
    peer.on('error', (err) => {
      console.error("PeerJS Error (PC):", err);
      peerError = err.type;
      connectionStatus = "連線失敗: " + err.type;
    });
    peer.on('close', () => {
      connectionStatus = "連線已關閉 (PC)";
    });
    peer.on('call', (call) => {
      connectionStatus = "手機已連線，正在接收影像...";
      call.answer(); // 接聽手機的來電
      call.on('stream', (stream) => {
        // 接收手機影像
        video = createVideo('');
        video.elt.srcObject = stream;
        video.elt.play();
        video.elt.muted = true; // 避免回音
        video.elt.setAttribute('playsinline', ''); // Added for remote video
        video.size(640, 480);
        video.hide();
        remoteStreamReady = true;
        
        // 初始化臉部偵測
        facemesh = ml5.facemesh(video, () => console.log("臉部偵測模型已準備好"));
        facemesh.on("predict", results => {
          predictions = results;
        });
      });
      call.on('close', () => {
        connectionStatus = "手機連線已中斷";
        remoteStreamReady = false;
        video = null; // Clear video
      });
    });
  }
}

function draw() {
  background(0);
  
  let boxW = 640;
  let boxH = 480;
  let x = (width - boxW) / 2;
  let y = (height - boxH) / 2;

  if (isPhone) {
    // 手機端：顯示自己的鏡頭當作預覽
    if (video && video.elt.readyState === 4 && video.width > 0) {
      // 手機端全螢幕預覽
      let imgW = width;
      let imgH = width * (video.height / video.width);
      image(video, 0, (height - imgH) / 2, imgW, imgH);
    } else {
      background(0); // Ensure background is black if video not ready
    }
    
    // 狀態顯示
    fill(0, 150);
    noStroke();
    rect(0, height - 100, width, 100);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(20);
    text(connectionStatus, width / 2, height - 65);
    if (peerError) {
      fill(255, 100, 100);
      text("錯誤: " + peerError, width / 2, height - 35);
    }
  } else {
    // 電腦端繪製
    stroke(255);
    noFill();
    rect(x, y, boxW, boxH);

    if (remoteStreamReady && video && video.elt.readyState === 4 && video.width > 0) {
      image(video, x, y, boxW, boxH); 
      drawFaceEffect(x, y);
    } else {
      fill(255);
      noStroke();
      textSize(24);
      textAlign(CENTER, CENTER);
      
      if (peerError) {
        fill(255, 100, 100);
        text('連線錯誤: ' + peerError, width / 2, height / 2 - 20);
        textSize(16);
        text('請檢查瀏覽器控制台是否有更多錯誤訊息', width / 2, height / 2 + 20);
      } else {
        text(connectionStatus, width / 2, height / 2);
      }
    }
  }

  // 學生資訊
  fill(255);
  noStroke();
  textSize(20);
  textAlign(CENTER, CENTER);
  text('414730050 曹苡萱', width / 2, y - 20);
}

function drawFaceEffect(offsetX, offsetY) {
  predictions.forEach(prediction => {
    const keypoints = prediction.scaledMesh;

    // 1. 畫紅鼻子 (點位 5 是鼻子中心)
    const nose = keypoints[5];
    fill(255, 0, 0, 200);
    noStroke();
    ellipse(offsetX + nose[0], offsetY + nose[1], 40, 40);

    // 2. 畫貓鬚 (點位 234, 454 是臉頰邊緣)
    stroke(255, 200);
    strokeWeight(4);
    line(offsetX + nose[0] - 20, offsetY + nose[1], offsetX + nose[0] - 100, offsetY + nose[1] - 20);
    line(offsetX + nose[0] - 20, offsetY + nose[1] + 15, offsetX + nose[0] - 100, offsetY + nose[1] + 20);
    line(offsetX + nose[0] + 20, offsetY + nose[1], offsetX + nose[0] + 100, offsetY + nose[1] - 20);
    line(offsetX + nose[0] + 20, offsetY + nose[1] + 15, offsetX + nose[0] + 100, offsetY + nose[1] + 20);
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
