# Serve the Angular app with Nginx on an AMD64 architecture. The app files are copied to the Nginx web root, and a custom configuration is used to serve the app. The container listens on port 80 and runs Nginx in the foreground.
FROM --platform=amd64 nginx:alpine

COPY dist/web/browser /var/www/htdocs
COPY nginx/site.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
