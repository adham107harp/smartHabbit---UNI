# Static frontend served by nginx.
# nginx also proxies /api and /socket.io to the backend so the browser
# only ever talks to one origin in production.

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Drop static assets at the standard root
COPY . /usr/share/nginx/html

# Clean up the build-time files (Dockerfile, nginx.conf) from the web root
RUN rm -f /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/nginx.conf \
          /usr/share/nginx/html/.dockerignore

EXPOSE 80
