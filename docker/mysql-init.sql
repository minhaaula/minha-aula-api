CREATE TABLE IF NOT EXISTS idempotency (
    `key` VARCHAR(128) PRIMARY KEY,
    payment_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (payment_id)
);


CREATE TABLE IF NOT EXISTS outbox (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(64) NOT NULL,
    aggregate_id CHAR(36) NOT NULL,
    payload_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    INDEX (aggregate_id),
    INDEX (processed_at)
);
