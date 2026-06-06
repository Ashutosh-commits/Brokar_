# ─── BROkar Scraper — Python / FastAPI ───────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Chrome / Chromium deps for undetected-chromedriver
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-driver \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Tell undetected-chromedriver to use the system Chromium
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy scraper source
COPY scraper.py .
COPY .env.example .

EXPOSE 8001

# Run in headless server mode
CMD ["python", "scraper.py", "--serve"]
