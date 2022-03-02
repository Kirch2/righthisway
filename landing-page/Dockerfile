# Create image based on the official Node image from the dockerhub
FROM mhart/alpine-node:12

# Create a directory where our app will be placed
RUN mkdir -p /usr/src/app

# Change directory so that our commands run inside this new directory
WORKDIR /usr/src/app

# Copy dependency definitions
COPY ./ /usr/src/app/

# Install dependencies
RUN yarn install

# Build the client
RUN yarn build

# Expose port 3000
EXPOSE 3000

# Start the Next.js app
CMD [ "yarn", "start" ]
