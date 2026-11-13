const express = require('express');
const {
  listBudgets,
  createBudget,
  updateBudget,
  listItems,
  getItem,
  createItem,
  updateItem,
} = require('../controllers/budgetController');
const { protect } = require('../middleware/auth');
const { requireSkAdmin, requireStaff } = require('../utils/roles');

// Annual Budget and ABYIP Item: the SK Admin records them; the SK side
// (including the Barangay Chairman) can view them.
const budgets = express.Router();
budgets.get('/', protect, requireStaff, listBudgets);
budgets.post('/', protect, requireSkAdmin, createBudget);
budgets.put('/:id', protect, requireSkAdmin, updateBudget);

const abyip = express.Router();
abyip.get('/', protect, requireStaff, listItems);
abyip.get('/:id', protect, requireStaff, getItem);
abyip.post('/', protect, requireSkAdmin, createItem);
abyip.put('/:id', protect, requireSkAdmin, updateItem);

module.exports = { budgets, abyip };
