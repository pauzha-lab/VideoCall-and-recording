import adapter from 'webrtc-adapter';

export const hasUserMedia = () => {
    if (navigator.mediaDevices) {
        return true
    }
}

export const getUserMedia = async (constraints) => {
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    return mediaStream;
}