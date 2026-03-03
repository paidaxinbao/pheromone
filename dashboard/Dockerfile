# Pheromone Dashboard
# Static file server for the Dashboard UI

FROM node:22-bookworm-slim

# Install http-server
RUN npm install -g http-server

WORKDIR /app

# Copy dashboard files
COPY index.html /app/index.html
COPY style.css /app/style.css
COPY app.js /app/app.js

# Expose port
EXPOSE 18890

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:18890 || exit 1

# Start http-server
CMD ["http-server", "-p", "18890", "--cors", "-c-1", "--charset", "utf-8"]
