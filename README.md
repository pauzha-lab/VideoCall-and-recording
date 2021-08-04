# A Simplistic Video Call room using Mediasoup with server-side recording using FFmpeg and GStreamer

### Configure files

- Change websocket address in video-call/src/lib/constants.js to your server public IP address
- To use HTTPS set PROTOCOL="HTTPS" as env variable, also make sure to add certificates (fullchain.pem, privkey.pem) to server/certs and video-call/certs. 


### Ports required

| PORT  | Protocol  | Description  |
| ------------ | ------------ | ------------ |
| 80  | TCP | HTTP web server   |
| 443  | TCP | HTTP web server   |
| 4000  | TCP | websocket port (only for development)  |
| 50000-59999  | TCP & UDP  | RTC port range |


### Server ENV Options

| Argument | Type | Description |
| -------- | -- | --------- |
| PROTOCOL | string | http/https . Note for https ssl certificates required |
| WEBAPP | string | web server url (default is http://localhost:5000) |
| RECORD_FILE_LOCATION_PATH | string | Path to store the recorded files (MUST have read/write permission) |
| GSTREAMER_DEBUG_LEVEL | number | GStreamer Debug Level (GStreamer only) |
| PROCESS_NAME | string | GStreamer/FFmpeg (case sensitive). default is FFmpeg |
| SERVER_PORT | number | Server port number (default is 4000 and 5000 for web app). |


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

cd server && node server

# The server uses FFmpeg as the default
# Change PUBLIC_ADDR to server external ip or domain name
PROCESS_NAME="GStreamer" PROTOCOL="HTTP" PUBLIC_ADDR="localhost" node server
```

### Docker

```bash
cd server

sudo docker build video-call/recorder .

# Change PUBLIC_ADDR to server external ip or domain name
sudo docker run -d --net=host -e PROTOCOL="HTTP" -e PUBLIC_ADDR="localhost" video-call/recorder
```

### Build and start the application

```bash
cd video-call

# Build react
npm run build

# default server port is 5000
PROTOCOL="HTTP" SERVER_PORT="80" node server
```