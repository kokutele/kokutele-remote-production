FROM restreamio/gstreamer:latest-prod-dbg

ENV TZ=Asia/Tokyo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone


RUN apt-get update && \
  apt-get dist-upgrade -y && \
  apt-get install -y --no-install-recommends \
    vim \
    curl \
    libunwind-dev \
    libdw-dev \
    git \
    less \
    netcat \
    python3-pip && \
  curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
  apt-get update && \
  apt-get install -y nodejs && \
  apt-get -y clean && \
  rm -rf /var/lib/apt/lists/*


WORKDIR /app