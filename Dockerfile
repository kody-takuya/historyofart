FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY dist /usr/share/nginx/html
