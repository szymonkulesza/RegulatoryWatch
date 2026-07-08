FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpoppler-cpp-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY fda_agent/ ./fda_agent/
COPY static/ ./static/
COPY main.py .
COPY recipients.json .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

VOLUME ["/app/data"]
EXPOSE 8000

CMD ["python", "main.py", "--web"]
