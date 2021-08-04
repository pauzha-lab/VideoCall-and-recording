FROM ubuntu:latest

ARG DEBIAN_FRONTEND=noninteractive

ENV TZ=Asia/Kolkata


RUN \
	set -x \
	&& apt-get update \
	&& apt-get install -y net-tools build-essential



RUN apt-get install --yes nodejs \
    npm


RUN apt-get install -y ffmpeg



RUN apt-get install -y  \
    autoconf \
    automake \
    libtool \
    gstreamer-1.0 \
    gstreamer1.0-dev \
    libgstreamer1.0-0 \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-doc \
    gstreamer1.0-tools \
    gstreamer1.0-x \
    gstreamer1.0-alsa \
    gstreamer1.0-gl \
    gstreamer1.0-gtk3 \
    gstreamer1.0-qt5 \
    gstreamer1.0-pulseaudio



WORKDIR /usr/src/app

COPY package.json .

RUN npm install

COPY . .

EXPOSE 4000/tcp 50000-59999/tcp 50000-59999/udp

CMD [ "node", "server.js" ]

