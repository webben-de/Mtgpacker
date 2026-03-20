# Serve the Angular app with Nginx
FROM --platform=amd64 nginx:alpine

COPY dist/web/browser /var/www/htdocs
COPY nginx/site.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
