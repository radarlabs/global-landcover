# Use the official Node.js version 18 image as a base
FROM node:18

# Update the package lists and install the required dependencies
RUN apt-get update && \
    apt-get install -y \
    awscli \
    libgdal-dev \
    build-essential \
    libsqlite3-dev \
    zlib1g-dev \
    git

# Build and install Tippecanoe from source
RUN git clone https://github.com/mapbox/tippecanoe.git && \
    cd tippecanoe && \
    make -j$(nproc) && \
    make install && \
    cd .. && \
    rm -rf tippecanoe

WORKDIR /app

COPY package*.json /app
RUN npm install gdal-async --build-from-source --shared_gdal

COPY . /app

# can override at container runtime
ENV PARALLEL=4

EXPOSE 3000
CMD ["npm", "start"]
