import './App.css';
import coins from './coins.png';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';
import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, push, remove } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const firebaseConfig = {
  apiKey: "AIzaSyCh_zZDa59mXcCrcilUrBWJcBsw_seRkc8",
  authDomain: "cointrack-f97ab.firebaseapp.com",
  databaseURL: "https://cointrack-f97ab-default-rtdb.firebaseio.com/",
  projectId: "cointrack-f97ab",
  storageBucket: "cointrack-f97ab.appspot.com",
  messagingSenderId: "1010129777674",
  appId: "1:1010129777674:web:82bb98233d840b7eb25bf3",
  measurementId: "G-FNBNCDQW9G"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signUpUser, setSignUpUser] = useState('');
  const [signUpPass, setSignUpPass] = useState('');
  const [signUpConfirm, setSignUpConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [currentBalance, setCurrentBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDescription, setIncomeDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [spendingPatterns, setSpendingPatterns] = useState([]);
  const calculateSpendingPatterns = () => {
    const expensesByCategory = {};
    
    const expenses = transactions.filter(t => t.type === 'expense');
    
    expenses.forEach(expense => {
      const category = expense.description || 'Uncategorized';
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = 0;
      }
      expensesByCategory[category] += parseFloat(expense.amount);
    });

    const patternsData = Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount: parseFloat(amount.toFixed(2))
    }));

    patternsData.sort((a, b) => b.amount - a.amount);
    
    setSpendingPatterns(patternsData);
  };

  useEffect(() => {
    if (isLoggedIn && auth.currentUser) {
      fetchTransactions();
    }
  }, [isLoggedIn]);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    if (signUpPass !== signUpConfirm) {
      setError('Passwords do not match');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signUpUser, signUpPass);
      await set(ref(db, 'users/' + userCredential.user.uid), {
        email: signUpUser,
        dateCreated: new Date().toISOString(),
      });

      alert("Sign-up successful! Please log in.");
      setSignUpUser('');
      setSignUpPass('');
      setSignUpConfirm('');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await signInWithEmailAndPassword(auth, username, password);
      setIsLoggedIn(true);
    } catch (error) {
      setError("Invalid username or password");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setUsername('');
      setPassword('');
      setTransactions([]);
      setCurrentBalance(0);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const incomesRef = ref(db, `users/${auth.currentUser.uid}/incomes`);
      const incomeSnapshot = await get(incomesRef);

      const expensesRef = ref(db, `users/${auth.currentUser.uid}/expenses`);
      const expenseSnapshot = await get(expensesRef);

      let allTransactions = [];

      if (incomeSnapshot.exists()) {
        const incomeData = incomeSnapshot.val();
        const incomeTransactions = Object.entries(incomeData).map(([id, data]) => ({
          id,
          type: 'income',
          ...data
        }));
        allTransactions = [...allTransactions, ...incomeTransactions];
      }

      if (expenseSnapshot.exists()) {
        const expenseData = expenseSnapshot.val();
        const expenseTransactions = Object.entries(expenseData).map(([id, data]) => ({
          id,
          type: 'expense',
          ...data
        }));
        allTransactions = [...allTransactions, ...expenseTransactions];
      }

      setTransactions(allTransactions);
      calculateBalance(allTransactions);
      calculateSpendingPatterns();
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const renderSpendingPatternsChart = () => (
    <Popup trigger={<button className='spendingPatterns'>Spending Patterns</button>} modal>
      {close => (
        <div className="modal spending-patterns-modal">
          <h3>Spending Patterns</h3>
          <div style={{ width: '100%', height: '70%' }}>
            <ResponsiveContainer>
              <BarChart data={spendingPatterns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis />
                <Tooltip formatter={(value) => ['$' + value.toFixed(2), 'Amount']}/>
                <Legend />
                <Bar dataKey="amount" fill="#8884d8" name="$ Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={close}>Close</button>
          </div>
        </div>
      )}
    </Popup>
  );


  const calculateBalance = (transactionArray) => {
    const incomeTotal = transactionArray
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const expenseTotal = transactionArray
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    setCurrentBalance(incomeTotal - expenseTotal);
  };

  const addTransaction = async (type, amount, description) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const transaction = {
        amount: parseFloat(amount),
        description: description.trim() || `${type.charAt(0).toUpperCase() + type.slice(1)}`,
        date: new Date().toISOString(),
        userId: auth.currentUser.uid
      };

      const nodeRef = ref(db, `users/${auth.currentUser.uid}/${type}s`);
      await push(nodeRef, transaction);
      
      if (type === 'expense') {
        setExpenseAmount('');
        setExpenseDescription('');
      } else {
        setIncomeAmount('');
        setIncomeDescription('');
      }
      
      fetchTransactions();
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert('Failed to add transaction');
    }
  };

  const deleteTransaction = async (transactionId, type) => {
    try {
      const transactionRef = ref(db, `users/${auth.currentUser.uid}/${type}s/${transactionId}`);
      await remove(transactionRef);
      fetchTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert('Failed to delete transaction');
    }
  };

  const generateSummary = () => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    alert(`
      Summary:
      Total Income: $${totalIncome.toFixed(2)}
      Total Expenses: $${totalExpenses.toFixed(2)}
      Net Balance: $${(totalIncome - totalExpenses).toFixed(2)}
    `);
  };

  const renderLoginPage = () => (
    <div className='openingPage'>
      <h1 className='appName'>CoinTrack</h1>
      <img className='coinLogoOne' src={coins} alt="Coin logo" />
      {error && <p className='error-message'>{error}</p>}
      <form onSubmit={handleLogin} className='login-form'>
        <input 
          type='text' 
          className='username' 
          placeholder="Email" 
          value={username}
          onChange={(e) => setUsername(e.target.value)} 
          required 
        />
        <br />
        <input 
          type='password' 
          className='password' 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        <br />
        <button type="submit" className='logIn'>Log In</button>
      </form>
      <p className='signUpText'>Don't have an account?</p>
      <Popup trigger={<button className='signUp'>Sign up here!</button>} modal nested>
        {close => (
          <div className='modal'>
            <h3>Create an Account</h3>
            <form onSubmit={(e) => {
              handleSignUp(e);
              close();
            }}>
              <input 
                type='email' 
                placeholder="Email" 
                value={signUpUser}
                onChange={(e) => setSignUpUser(e.target.value)} 
                required 
              />
              <input 
                type='password' 
                placeholder="Password" 
                value={signUpPass}
                onChange={(e) => setSignUpPass(e.target.value)} 
                required 
              />
              <input 
                type='password' 
                placeholder="Confirm Password" 
                value={signUpConfirm}
                onChange={(e) => setSignUpConfirm(e.target.value)} 
                required 
              />
              <button type="submit">Sign up</button>
              <button type="button" onClick={close}>Cancel</button>
            </form>
          </div>
        )}
      </Popup>
    </div>
  );

  const renderDashboard = () => (
    <div className='dashboardPage'>
      <header className='dashboard-header'>
        <h1 className='appNameDash'>CoinTrack</h1>
        <img src={coins} className='tinyLogoDash' alt="Coin logo" />
        <button className='logout-button' onClick={handleLogout}>Logout</button>
      </header>

      <div className='dashboard-content'>        
          <input 
            className='search-bar'
            type='text' 
            placeholder='Search Transactions'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        <h2 className='welcome'>Welcome, {username}</h2>
        <br></br>

        <div className='row1'>
        <Popup trigger={<button className='recentTransactions'>Update or Delete Past Transactions</button>} modal>
            {close => (
                      <div className="transactions-section">
                      <h3>Recent Transactions</h3>
                      <div className="transactions-list">
                        {transactions
                          .filter(transaction => 
                            transaction.description.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map(transaction => (
                            <div key={transaction.id} className={`transaction-item ${transaction.type}`}>
                              <div className="transaction-date">
                                {new Date(transaction.date).toLocaleDateString()}
                              </div>
                              <div className="transaction-description">
                                {transaction.description}
                              </div>
                              <div className="transaction-amount">
                                {transaction.type === 'income' ? '+' : '-'}
                                ${transaction.amount.toFixed(2)}
                              </div>
                              <button 
                                className="delete-button"
                                onClick={() => deleteTransaction(transaction.id, transaction.type)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>            
            )}
          </Popup>
          {renderSpendingPatternsChart()}
          <div className='balance-card'>
            <h3 style={{fontSize:'1.8vw'}}>Current Balance</h3>
            <div className={`balance-amount ${currentBalance >= 0 ? 'positive' : 'negative'}`}>
              ${currentBalance.toFixed(2)}
            </div>
          </div>
        </div>

        <br></br>
        <div className='action-buttons'>
          <Popup trigger={<button className='add-button expense'>Add Expense</button>} modal>
            {close => (
              <div className="modal transaction-modal">
                <h3>Add Expense</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  addTransaction('expense', expenseAmount, expenseDescription);
                  close();
                }}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                  />
                  <button type="submit">Add Expense</button>
                  <button type="button" onClick={close}>Cancel</button>
                </form>
              </div>
            )}
          </Popup>

          <Popup trigger={<button className='add-button income'>Add Income</button>} modal>
            {close => (
              <div className="modal transaction-modal">
                <h3>Add Income</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  addTransaction('income', incomeAmount, incomeDescription);
                  close();
                }}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={incomeDescription}
                    onChange={(e) => setIncomeDescription(e.target.value)}
                  />
                  <button type="submit">Add Income</button>
                  <button type="button" onClick={close}>Cancel</button>
                </form>
              </div>
            )}
          </Popup>

          <button className='summary-button' onClick={generateSummary}>
            Generate Summary
          </button>
        </div>

      </div>
    </div>
  );

  return isLoggedIn ? renderDashboard() : renderLoginPage();
}

export default App;
