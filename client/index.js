import { io } from "socket.io-client";

// Global State
let peer;
const myVideo = document.getElementById("my-video");
const strangerVideo = document.getElementById("video");
const button = document.getElementById("send");
const input = document.getElementById("chat-input");
let remoteSocket;
let type;
let roomid;

// Function to handle sending messages
const sendMessage = () => {
  const inputValue = input.value.trim();
  if (inputValue) {
    socket.emit("send-message", inputValue, type, roomid);

    // set input in local message box as 'YOU'
    const msghtml = `
      <div class="msg">
        <b>You: </b> <span id='msg'>${inputValue}</span>
      </div>
    `;
    document.querySelector(".chat-holder .wrapper").innerHTML += msghtml;

    // clear input
    input.value = "";
  }
};

// Event listeners for sending messages
button.onclick = sendMessage;

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// starts media capture
function start() {
  navigator.mediaDevices
    .getUserMedia({ audio: true, video: true })
    .then((stream) => {
      if (peer) {
        myVideo.srcObject = stream;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        peer.ontrack = (e) => {
          strangerVideo.srcObject = e.streams[0];
          strangerVideo.play();
        };
      }
    })
    .catch((ex) => {
      console.log(ex);
    });
}

// connect to server
const socket = io("https://strangetalks.onrender.com/");

// disconnect event
socket.on("disconnected", () => {
  location.href = "/?disconnect";
});

// Start
socket.emit("start", (person) => {
  type = person;
});

// Get remote socket
socket.on("remote-socket", (id) => {
  remoteSocket = id;

  // hide the spinner
  document.querySelector(".modal").style.display = "none";

  // create a peer connection
  peer = new RTCPeerConnection();

  // on negotiation needed
  peer.onnegotiationneeded = async () => {
    webrtc();
  };

  // send ice candidates to remote socket
  peer.onicecandidate = (e) => {
    socket.emit("ice:send", { candidate: e.candidate, to: remoteSocket });
  };

  // start media capture
  start();
});

// creates offer if 'type' = p1
async function webrtc() {
  if (type == "p1") {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("sdp:send", { sdp: peer.localDescription });
  }
}

// receive sdp sent by remote socket
socket.on("sdp:reply", async ({ sdp }) => {
  await peer.setRemoteDescription(new RTCSessionDescription(sdp));

  if (type == "p2") {
    const ans = await peer.createAnswer();
    await peer.setLocalDescription(ans);
    socket.emit("sdp:send", { sdp: peer.localDescription });
  }
});

// receive ice-candidate from remote socket
socket.on("ice:reply", async ({ candidate }) => {
  await peer.addIceCandidate(candidate);
});

// get room id
socket.on("roomid", (id) => {
  roomid = id;
});

// handle received message
socket.on("get-message", (input) => {
  const msghtml = `
    <div class="msg">
      <b>Stranger: </b> <span id='msg'>${input}</span>
    </div>
  `;
  document.querySelector(".chat-holder .wrapper").innerHTML += msghtml;
});
