# Pheromone Agent Runtime
# Base image for all Agent containers

FROM node:22-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm/yarn
RUN corepack enable

# Create app directory
WORKDIR /app

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Copy callback server
COPY callback-server/ /app/callback-server/

# Copy Pheromone Skill
COPY pheromone-skill/ /app/pheromone-skill/

# Copy startup script
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Expose callback port
EXPOSE 9000

# Set environment variables (can be overridden)
ENV CALLBACK_PORT=9000
ENV HUB_URL=http://hub:18888
ENV OPENCLAW_URL=http://localhost:18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:9000/health || exit 1

# Start agent
CMD ["/app/startup.sh"]
