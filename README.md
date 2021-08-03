# A Simplistic Video Call room using Mediasoup with server-side recording using FFmpeg and GStreamer

### Configure files

- Change the announced IP in server/config.js to your external IP or domain name
- Change websocket address in video-call/src/lib/constants.js to your server public IP address


### Install Server Modules

```bash
cd server && npm i
```

### Install Web App Modules

```bash
cd video-call && npm i
```

### Install GStreamer

```bash
# For Ubuntu
sudo apt install libgstreamer1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav gstreamer1.0-doc gstreamer1.0-tools gstreamer1.0-x gstreamer1.0-alsa gstreamer1.0-gl gstreamer1.0-gtk3 gstreamer1.0-qt5 gstreamer1.0-pulseaudio
```

### Install FFmpeg
```bash
sudo apt install ffmpeg
```

### Start the server

```bash
# The server uses FFmpeg as the default
cd server && node server

# To use GStreamer
PROCESS_NAME="GStreamer" node server
```

### Build and start the application

```bash
cd video-call
npm start
```