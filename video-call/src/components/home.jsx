import { useState, useEffect } from 'react';
import {peerSession} from '../lib/peerSession';

function Home() {

    // show join form
    const [JoinVisible, setJoinVisible] = useState(false);

    // room session
    const [Session, setSession] = useState(null);

    // room code
    const [roomId, setRoomId] = useState('');

    // room session status
    const [sessionStatus, setSessionStatus] = useState("");

    // session type - join or create
    const [sessionType, setSessionType] = useState("");

    // room status
    const [roomStatus, setRoomStatus] = useState("connecting");

    // room status in text for displaying
    const [roomStatusText, setRoomStatusText] = useState("connecting")

    // For toggling microphone
    const [muted, setMuted] = useState(false);

    // For toggling video
    const [videoPaused, setVideoPaused] = useState(false);

    // For toggling output audio
    const [speakerPaused, setSpeakerPaused] = useState(false);

    // show and hide invite link
    const [showInvitationLink, setShowInvitationLink] = useState(false)

    // peerSession config
    const session_config = {
        localElm: "local",
        remoteElm: "remote",
        audioInpSelect: "audioInpSelect",
        audioOutSelect: "audioOutSelect",
        videoInpSelect: "videoInpSelect"
    };


    const joinRoom = () => {

        if (!JoinVisible && roomId === '') {
            setJoinVisible(true);
            return;
        }
        openJoinRoom(roomId);

    }

    const openJoinRoom = (room_id) => {
        console.log("openJoinRoom ")
        setSessionType("join");

        const session = new peerSession(session_config);
        setSessionStatus("active");
        setSession(session);
        handleSessionEvents(session);

        console.log("joining room " + room_id);
        session.join(room_id);
    }

    const prevJoin = () => {
        setJoinVisible(false);
    }

    const createRoom = () => {
        console.log("createRoom ")
        setSessionType("create");
        setSessionStatus("active");
        const session = new peerSession(session_config);

        setSession(session);
        handleSessionEvents(session);
        session.create();
    }

    const handleSessionEvents = (room) => {
        
        room.events.on("room_created", (roomId) => {
            setRoomId(roomId);
            setRoomStatusText("ready");
            setShowInvitationLink(true);
        });

        room.events.on("connected", () => {
            setRoomStatus("connected");
            setRoomStatusText("connected");
        });

        room.events.on("closed", () => {
            endCall()
        })

        room.events.on("room_not_found", () => {
            console.log("room not found");
        })

        room.events.on("room_full", () => {

        })
    }

    const toggleVideo = () => {
        if (videoPaused) {
            Session.enableVideo();
            setVideoPaused(false);
        } else {
            Session.disableVideo();
            setVideoPaused(true);
        }
    }

    const toggleMic = () => {
        if (muted) {
            Session.enableAudio();
            setMuted(false);
        } else {
            Session.disableAudio();
            setMuted(true);
        }
    }

    const toggleSpeaker = () => {
        if (speakerPaused) {
            Session.unmuteOutput();
            setSpeakerPaused(false);
        } else {
            Session.muteOutput();
            setSpeakerPaused(true);
        }
    }

    const endCall = () => {

        if (Session) {
            Session.leave();
            Session.close();
        }

        setSession(null);
        setSessionStatus("");
        setRoomId("");
        setShowInvitationLink(false);

        if (sessionType === "join") {
            window.location.href = window.location.href.split('?')[0];
        }
        setSessionType("");
    }

    const changeAudioInput = (e) => {
        if (!e.target.value) {
            return;
        }
        const deviceId = e.target.value;
        Session.changeAudioInput(deviceId);
    }

    const changeVideoInput = (e) => {
        if (!e.target.value) {
            return;
        }
        const deviceId = e.target.value;
        Session.changeVideoInput(deviceId);
    }

    const changeAudioOutput = (e) => {
        if (!e.target.value) {
            return;
        }
        const deviceId = e.target.value;
        Session.changeAudioOutput(deviceId);
    }

    const FindParams = () => {
        const windowUrl = window.location.search;
        const params = new URLSearchParams(windowUrl);

        if (params.has("roomId")) {
            const room_id = params.get("roomId");
            setRoomId(room_id);
            openJoinRoom(room_id);
        }
    }

    useEffect(() => {

        FindParams()

        return () => {
            if (Session) {
                Session.close()
            }
            setShowInvitationLink(false);
            setSessionStatus("");
            setRoomId("");
            setSessionType("");
        }
    }, []);

    return (
        <div className="vd-elm">
            <div className={"vd-elms" + (sessionStatus === "active" ? " show" : " hide")}>
                <video id="local" autoPlay muted></video>
                <video id="remote" autoPlay></video>
            </div>
            <div className="controls">
                {sessionStatus === "active" ? <div>
                    <button type="button" className={speakerPaused ? "btn btn-light paused" : "btn btn-light"} onClick={toggleSpeaker}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#383838" className="bi bi-volume-mute" viewBox="0 0 16 16">
                            <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96V5.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z" />
                        </svg>
                    </button>
                    <button type="button" className={videoPaused ? "btn btn-light paused" : "btn btn-light"} onClick={toggleVideo}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#383838" className="bi bi-camera-video-off" viewBox="0 0 16 16">
                            <path fillRule="evenodd" d="M10.961 12.365a1.99 1.99 0 0 0 .522-1.103l3.11 1.382A1 1 0 0 0 16 11.731V4.269a1 1 0 0 0-1.406-.913l-3.111 1.382A2 2 0 0 0 9.5 3H4.272l.714 1H9.5a1 1 0 0 1 1 1v6a1 1 0 0 1-.144.518l.605.847zM1.428 4.18A.999.999 0 0 0 1 5v6a1 1 0 0 0 1 1h5.014l.714 1H2a2 2 0 0 1-2-2V5c0-.675.334-1.272.847-1.634l.58.814zM15 11.73l-3.5-1.555v-4.35L15 4.269v7.462zm-4.407 3.56-10-14 .814-.58 10 14-.814.58z" />
                        </svg>
                    </button>
                    <button type="button" className="btn btn-light" onClick={endCall}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#ea5000" className="bi bi-telephone" viewBox="0 0 16 16">
                            <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z" />
                        </svg>
                    </button>
                    <button type="button" className={muted ? "btn btn-light muted" : "btn btn-light"} onClick={toggleMic}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#383838" className="bi bi-mic-mute" viewBox="0 0 16 16">
                            <path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4.02 4.02 0 0 0 12 8V7a.5.5 0 0 1 1 0v1zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a4.973 4.973 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4zm3-9v4.879l-1-1V3a2 2 0 0 0-3.997-.118l-.845-.845A3.001 3.001 0 0 1 11 3z" />
                            <path d="m9.486 10.607-.748-.748A2 2 0 0 1 6 8v-.878l-1-1V8a3 3 0 0 0 4.486 2.607zm-7.84-9.253 12 12 .708-.708-12-12-.708.708z" />
                        </svg>
                    </button>
                    <button type="button" className="btn btn-light" data-bs-toggle="modal" data-bs-target="#settings">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#383838" className="bi bi-gear" viewBox="0 0 16 16">
                            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
                            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
                        </svg>
                    </button>
                </div> : ""}
            </div>
            {sessionStatus !== "active" ?
                <div className="container">
                    <div className="ctns-ctn">
                        {!JoinVisible ? <button id="create" type="button" className="btn btn-primary" onClick={createRoom}>Create Room </button> : ""}

                        {JoinVisible ?
                            <div>
                                <div className="back" onClick={prevJoin}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#0d6efd" className="bi bi-arrow-left-circle-fill" viewBox="0 0 16 16">
                                        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.5 7.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5z" />
                                    </svg>
                                </div>

                                <div className="inputs-ctn">

                                    <div className="input-group flex-nowrap">
                                        <span className="input-group-text" id="addon-wrapping">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#0d6efd" className="bi bi-camera-video" viewBox="0 0 16 16">
                                                <path fillRule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556v4.35zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H2z" />
                                            </svg>
                                        </span>
                                        <input type="text" className="form-control" placeholder="Room Id" aria-label="Username" aria-describedby="addon-wrapping"
                                            onChange={event => setRoomId(event.target.value)} />
                                    </div>
                                </div>
                            </div>

                            : ""}

                        <button id="join" type="button" className="btn btn-primary" onClick={joinRoom}>Join Room</button>
                    </div>

                </div>
                :
                <div>
                    <div className="state">
                        <div className={"icon " + roomStatus}></div>
                        <p className={"text " + roomStatus}>{roomStatusText}</p>
                    </div>
                    <div></div>
                </div>
            }
            {showInvitationLink ?
                <div className="room-link-wrapper">
                    <div className="room-link">
                        <a className="link" href={window.location.href + "?roomId=" + roomId}
                            target="_blank" rel="noopener noreferrer"
                            onClick={() => { navigator.clipboard.writeText(window.location.href + "?roomId=" + roomId) }}>
                            invitation link

                        </a>
                    </div></div> : ""}

            <div className="modal fade" id="settings" tabIndex="-1" aria-labelledby="settingsModalLabel" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="settingsModalLabel">Settings</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="stgs-ctn">
                                <div className="form-floating">
                                </div>
                                <label>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#0d6efd" className="bi bi-camera-video" viewBox="0 0 16 16">
                                        <path fillRule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556v4.35zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H2z" />
                                    </svg>
                                    Video input source :</label>
                                <select className="form-select" aria-label="Video input source" id="videoInpSelect"
                                    onChange={changeVideoInput}>
                                </select>
                            </div>
                            <div className="stgs-ctn">
                                <label>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#0d6efd" className="bi bi-mic" viewBox="0 0 16 16">
                                        <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z" />
                                        <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3z" />
                                    </svg>
                                    Audio input source :
                                </label>
                                <select className="form-select" aria-label="Audio input source" id="audioInpSelect"
                                    onChange={changeAudioInput}>
                                </select>
                            </div>
                            <div className="stgs-ctn">
                                <label>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#0d6efd" className="bi bi-volume-up" viewBox="0 0 16 16">
                                        <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z" />
                                        <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z" />
                                        <path d="M10.025 8a4.486 4.486 0 0 1-1.318 3.182L8 10.475A3.489 3.489 0 0 0 9.025 8c0-.966-.392-1.841-1.025-2.475l.707-.707A4.486 4.486 0 0 1 10.025 8zM7 4a.5.5 0 0 0-.812-.39L3.825 5.5H1.5A.5.5 0 0 0 1 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 7 12V4zM4.312 6.39 6 5.04v5.92L4.312 9.61A.5.5 0 0 0 4 9.5H2v-3h2a.5.5 0 0 0 .312-.11z" />
                                    </svg>
                                    Audio output source :
                                </label>
                                <select className="form-select" aria-label="Audio output destination" id="audioOutSelect"
                                    onChange={changeAudioOutput}>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-primary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
