const uuidv4 = require('uuid/v4');
const crypto = require('crypto');
const moment = require('moment-timezone');
const GatewayTransaction = require('../models/gatewayTransaction.model');
const APIError = require('../utils/APIError');
const httpStatus = require('http-status');
const Customer = require('../models/customer.model');
const Transaction = require('../models/transaction.model');

async function simulateGatewayCall(card, amount) {
  let status = 'success';
  if (card === '4242424242424242') {
    status = 'failure';
  }

  const hex = crypto.randomBytes(Math.ceil(6 / 2))
    .toString('hex')
    .slice(0, 6);
  // eslint-disable-next-line camelcase
  const auth_code = parseInt(hex, 16);

  return {
    transactionId: uuidv4(),
    status,
    paymentDate: moment(),
    amount,
    authorizationCode: auth_code,
  };
}

exports.withdrawal = async (accountNumber, card, amount) => {
  const gatewayResponse = await simulateGatewayCall(card, amount);
  const gatewayTransaction = new GatewayTransaction(gatewayResponse);
  const savedGatewayTransaction = await gatewayTransaction.save();
  if (savedGatewayTransaction.status === 'failure') {
    throw new APIError({
      message: 'Withdrawal Rejected',
      status: httpStatus.BAD_GATEWAY,
    });
  }

  const transaction = new Transaction();
  transaction.amount = -amount;
  transaction.operation = 'withdrawal';
  transaction.accountNumber = accountNumber;
  transaction.reference = `withdrawal_gateway_transaction:${savedGatewayTransaction.transactionId}`;
  await transaction.save();
  const savedCustomer = await Customer.findOne({ accountNumber });
  // eslint-disable-next-line max-len
  const response = { transaction: transaction.transform(), customer: savedCustomer.transformBalance() };
  return response;
};
