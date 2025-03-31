// config/paystack.js
const https = require("https");

class PaystackConfig {
  constructor() {
    this.baseUrl = "api.paystack.co";
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
  }

  /**
   * Initialize a transaction
   * @param {Object} data - Transaction data (email, amount, etc.)
   * @returns {Promise} - Paystack response
   */
  initiateTransaction(data) {
    return new Promise((resolve, reject) => {
      const params = JSON.stringify({
        email: data.email,
        amount: data.amount * 100, // Paystack expects amount in kobo
        callback_url: data.callbackUrl,
        reference: data.reference || "",
        metadata: data.metadata || {},
      });

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: "/transaction/initialize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
          "Content-Length": params.length,
        },
      };

      const req = https
        .request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            resolve(JSON.parse(data));
          });
        })
        .on("error", (error) => {
          reject(error);
        });

      req.write(params);
      req.end();
    });
  }

  /**
   * Verify a transaction
   * @param {String} reference - Transaction reference
   * @returns {Promise} - Paystack response
   */
  verifyTransaction(reference) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: `/transaction/verify/${reference}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      };

      const req = https
        .request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            resolve(JSON.parse(data));
          });
        })
        .on("error", (error) => {
          reject(error);
        });

      req.end();
    });
  }

  /**
   * Transfer funds to a recipient
   * @param {Object} data - Transfer data (amount, recipient_code, etc.)
   * @returns {Promise} - Paystack response
   */
  transferFunds(data) {
    return new Promise((resolve, reject) => {
      const params = JSON.stringify({
        source: "balance",
        amount: data.amount * 100,
        recipient: data.recipientCode,
        reason: data.reason || "Payment",
      });

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: "/transfer",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
          "Content-Length": params.length,
        },
      };

      const req = https
        .request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            resolve(JSON.parse(data));
          });
        })
        .on("error", (error) => {
          reject(error);
        });

      req.write(params);
      req.end();
    });
  }

  /**
   * Create a transfer recipient
   * @param {Object} data - Recipient data (type, name, account_number, bank_code)
   * @returns {Promise} - Paystack response
   */
  createTransferRecipient(data) {
    return new Promise((resolve, reject) => {
      const params = JSON.stringify({
        type: data.type || "nuban",
        name: data.name,
        account_number: data.accountNumber,
        bank_code: data.bankCode,
        currency: data.currency || "NGN",
      });

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: "/transferrecipient",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
          "Content-Length": params.length,
        },
      };

      const req = https
        .request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            resolve(JSON.parse(data));
          });
        })
        .on("error", (error) => {
          reject(error);
        });

      req.write(params);
      req.end();
    });
  }
}

module.exports = new PaystackConfig();
