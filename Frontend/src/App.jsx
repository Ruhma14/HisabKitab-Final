import { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";
import Suppliers from "./pages/Suppliers";
import SupplierDetails from "./pages/SupplierDetails";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Modal from "./components/Modal";
import Button from "./components/Button";
import { COUNTRY_CODES } from "./constants/countryCodes";
import {
  getActiveSession,
  clearSession,
  initOwnerCredentials,
} from "./services/authService";
import {
  generateUniqueReceiptNumber,
  isReceiptNumberUnique,
} from "./utils/receiptUtils";
import { exportTransactionReceiptPDF } from "./services/exportService";
import { sendTransactionEmail } from "./services/emailService";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "./services/api";


export default function App() {
  const activeSession = getActiveSession();
  const [isAuthenticated, setIsAuthenticated] = useState(!!activeSession);
  const [loading, setLoading] = useState(!!activeSession);
  const [currentPage, setCurrentPage] = useState(() => localStorage.getItem("hisabkitab_currentPage") || (activeSession ? "dashboard" : "login"));
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => localStorage.getItem("hisabkitab_selectedCustomerId") || null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(() => localStorage.getItem("hisabkitab_selectedSupplierId") || null);
  const [shopInfo, setShopInfo] = useState({name:"Alam Garments",owner:"Muhammad Ali",countryCode:"+92",phone:"",email:"",currency:"Rs.",category:"Garments & Clothing",creditLimit:50000,whatsappReceipts:true,smsReminders:true,autoBackup:true});
  const [customers,setCustomers]=useState([]);
  const [suppliers,setSuppliers]=useState([]);
  const [transactions,setTransactions]=useState([]);
  const [supplierTransactions,setSupplierTransactions]=useState([]);
  const [inventory,setInventory]=useState([]);
  const [activeTxnFilter,setActiveTxnFilter]=useState("all");
  const [activeCustFilter,setActiveCustFilter]=useState("all");

  const refreshData = async () => {
    const data = await apiGet('/bootstrap');
    setCustomers((data.customers || []).map(c => ({...c, id:c._id || c.id})));
    setSuppliers((data.suppliers || []).map(normalizeSupplier));
    setTransactions((data.transactions || []).map(t => ({...t, id:t._id || t.id, customerId:String(t.customerId)})));
    setSupplierTransactions((data.supplierTransactions || []).map(t => ({...t, id:t._id || t.id, supplierId:String(t.supplierId)})));
    setInventory(data.inventory || []);
    if(data.shopInfo) setShopInfo(data.shopInfo);
    return data;
  };
  useEffect(()=>{ if(isAuthenticated){setLoading(true); refreshData().catch(e=>{console.error(e); clearSession(); setIsAuthenticated(false); setCurrentPage('login');}).finally(()=>setLoading(false));}},[isAuthenticated]);

  const handleUpdateShopInfo = async (updatedInfo) => {
    try { const data=await apiPut('/settings',updatedInfo); setShopInfo(data); toast.success("Profile & Store Settings Saved!",{description:`${data.name} settings and profile updated successfully.`}); }
    catch(e){toast.error("Could not save settings",{description:e.message});}
  };

  const handleAddSupplier = async (newSupplierData) => {
    try { const s=await apiPost('/suppliers',newSupplierData); await refreshData(); toast.success(`Supplier Added: ${s.name}`,{description:`Account created with ${shopInfo.currency} ${(Number(s.currentBalance)||0).toLocaleString()} initial balance.`}); }
    catch(e){toast.error("Could not add supplier",{description:e.message});}
  };
  const handleUpdateSupplier = async (supplierId,updatedData) => { try{const s=await apiPut(`/suppliers/${supplierId}`,updatedData);setSuppliers(prev=>prev.map(x=>x.id===s._id?normalizeSupplier(s):x));toast.success("Supplier Updated",{description:`${s.name} records saved successfully.`});}catch(e){toast.error("Could not update supplier",{description:e.message});} };
  const handleDeleteSupplier = async (supplierId) => { try{const target=suppliers.find(s=>s.id===supplierId);await apiDelete(`/suppliers/${supplierId}`);await refreshData();if(selectedSupplierId===supplierId){setSelectedSupplierId(null);handleNavigate('suppliers');}toast.info("Supplier Deleted",{description:`Supplier "${target?.name||supplierId}" has been removed from directory.`});}catch(e){toast.error("Could not delete supplier",{description:e.message});} };
  const handleToggleSupplierStatus = async (supplierId) => { const s=suppliers.find(x=>x.id===supplierId); if(!s)return; try{const next=s.status==='Active'?'Inactive':'Active';const updated=await apiPatch(`/suppliers/${supplierId}/status`,{status:next});setSuppliers(prev=>prev.map(x=>x.id===supplierId?normalizeSupplier(updated):x));toast.success("Supplier Status Updated",{description:`${s.name} is now marked as ${next}.`});}catch(e){toast.error("Could not update status",{description:e.message});} };
  const handleRecordPurchase = async (purchaseTxn, meta) => { try{const result=await apiPost(`/suppliers/${meta.supplierId}/purchases`,{date:purchaseTxn.date,item:purchaseTxn.item,quantity:meta.quantity||purchaseTxn.quantity,purchasePrice:purchaseTxn.purchasePrice,amountPaid:meta.amountPaid,notes:purchaseTxn.notes,reference:purchaseTxn.reference});await refreshData();toast.success(`Purchase Recorded: ${shopInfo.currency} ${Number(meta.totalAmount).toLocaleString()}`,{description:`For ${result.supplier.name}. Remaining: ${shopInfo.currency} ${Number(meta.remaining).toLocaleString()}`}); if(result.supplier.email){sendTransactionEmail({toEmail:result.supplier.email,toName:result.supplier.name,recipientType:'Supplier',transactionType:'Purchase',amount:meta.totalAmount,date:purchaseTxn.date,description:purchaseTxn.description||purchaseTxn.item,updatedBalance:result.updatedBalance,previousBalance:result.previousBalance,currency:shopInfo.currency,billNumber:purchaseTxn.reference,shopInfo}).then(r=>r.success&&toast.success(`Notification email sent to ${result.supplier.name}`));}}catch(e){toast.error("Could not record purchase",{description:e.message});} };
  const handleMakePayment = async (paymentTxn, meta) => { try{const result=await apiPost(`/suppliers/${meta.supplierId}/payments`,{date:paymentTxn.date,amount:meta.amountPaid,paymentMethod:paymentTxn.paymentMethod,reference:paymentTxn.reference,notes:paymentTxn.notes});await refreshData();toast.success(`Payment Recorded: ${shopInfo.currency} ${Number(meta.amountPaid).toLocaleString()}`,{description:`Payment sent to ${result.supplier.name} successfully.`});if(result.supplier.email){sendTransactionEmail({toEmail:result.supplier.email,toName:result.supplier.name,recipientType:'Supplier',transactionType:'Payment',amount:meta.amountPaid,date:paymentTxn.date,description:paymentTxn.description,updatedBalance:result.updatedBalance,previousBalance:result.previousBalance,currency:shopInfo.currency,billNumber:paymentTxn.reference,shopInfo}).then(r=>r.success&&toast.success(`Notification email sent to ${result.supplier.name}`));}}catch(e){toast.error("Could not record payment",{description:e.message});} };

  const handleNavigate = (page,targetOrFilter=null) => {setCurrentPage(page); if(page==='transactions')setActiveTxnFilter(typeof targetOrFilter==='string'?targetOrFilter:targetOrFilter?.typeFilter||'all'); if(page==='customers')setActiveCustFilter(typeof targetOrFilter==='string'?targetOrFilter:targetOrFilter?.statusFilter||'all'); try{localStorage.setItem('hisabkitab_currentPage',page);if(page==='customer-details'){const id=typeof targetOrFilter==='string'?targetOrFilter:targetOrFilter?.id;setSelectedCustomerId(id);if(id)localStorage.setItem('hisabkitab_selectedCustomerId',id);}else{setSelectedCustomerId(null);localStorage.removeItem('hisabkitab_selectedCustomerId');}if(page==='supplier-details'){const id=typeof targetOrFilter==='string'?targetOrFilter:targetOrFilter?.id;setSelectedSupplierId(id);if(id)localStorage.setItem('hisabkitab_selectedSupplierId',id);}else{setSelectedSupplierId(null);localStorage.removeItem('hisabkitab_selectedSupplierId');}}catch{} window.scrollTo({top:0,behavior:'smooth'});};

  const handleOpenAddTransaction = (type='Udhaar',customerId=null)=>{const defaultCust=customerId||(customers[0]?.id||'');setTxnForm({customerId:defaultCust,type,amount:'',description:'',paymentMethod:type==='Udhaar'?'Khata Credit':'Cash',billNumber:generateUniqueReceiptNumber(transactions,type),date:new Date().toISOString().split('T')[0]});setTxnModalOpen(true);};
  const handleSaveTransaction = async (e) => {e.preventDefault();if(!txnForm.customerId)return toast.error('Please select a customer for this entry.');if(!txnForm.amount||Number(txnForm.amount)<=0)return toast.error('Please enter a valid amount greater than 0.');let bill=(txnForm.billNumber||'').trim()||generateUniqueReceiptNumber(transactions,txnForm.type);if(!isReceiptNumberUnique(bill,transactions)){toast.error('Duplicate Receipt Number!');return;}const target=customers.find(c=>c.id===txnForm.customerId);try{const result=await apiPost(`/customers/${txnForm.customerId}/transactions`,{type:txnForm.type,amount:Number(txnForm.amount),date:txnForm.date,description:txnForm.description,paymentMethod:txnForm.paymentMethod,billNumber:bill});setTxnModalOpen(false);await refreshData();toast.success(`${txnForm.type==='Udhaar'?'Udhaar Recorded':'Jama Payment'}: ${shopInfo.currency} ${Number(txnForm.amount).toLocaleString()}`,{description:`For ${target?.name||'Customer'} (Receipt: ${bill})`});if(target?.email){sendTransactionEmail({toEmail:target.email,toName:target.name,recipientType:'Customer',transactionType:result.transaction.type,amount:result.transaction.amount,date:result.transaction.date,description:result.transaction.description,updatedBalance:result.updatedBalance,previousBalance:result.previousBalance,currency:shopInfo.currency,billNumber:result.transaction.billNumber,shopInfo}).then(r=>r.success&&toast.success(`Notification email sent to ${target.name}`));}}catch(err){toast.error('Could not save transaction',{description:err.message});}};
  const handleOpenAddCustomer=()=>{setCustForm({name:'',countryCode:shopInfo?.countryCode||'+92',phone:'',email:'',address:'',openingBalance:''});setCustModalOpen(true);};
  const handleSaveCustomer=async(e)=>{e.preventDefault();const cleanName=custForm.name.trim();if(!cleanName)return toast.error('Customer name is required.');if(!/^[a-zA-Z\s]+$/.test(cleanName))return toast.error('Invalid Customer Name',{description:'Customer name must only contain alphabetic letters and spaces.'});if(!custForm.phone.trim())return toast.error('Phone number is required.');try{const c=await apiPost('/customers',{...custForm,name:cleanName,phone:`${custForm.countryCode||'+92'} ${custForm.phone.trim()}`,openingBalance:Number(custForm.openingBalance||0)});setCustModalOpen(false);await refreshData();toast.success(`Customer Added: ${c.name}`,{description:`Khata account created with ${shopInfo.currency} ${(Number(c.balance)||0).toLocaleString()} initial balance.`});}catch(err){toast.error('Could not add customer',{description:err.message});}};
  const handleLogin=(loginData)=>{setIsAuthenticated(true);setCurrentPage('dashboard');localStorage.setItem('hisabkitab_currentPage','dashboard');if(loginData?.shopInfo)setShopInfo(prev=>({...prev,...loginData.shopInfo}));};
  const handleLogout=()=>{clearSession();setIsAuthenticated(false);setCustomers([]);setSuppliers([]);setTransactions([]);setSupplierTransactions([]);setCurrentPage('login');localStorage.removeItem('hisabkitab_currentPage');localStorage.removeItem('hisabkitab_selectedCustomerId');localStorage.removeItem('hisabkitab_selectedSupplierId');};

  function normalizeSupplier(s){return {...s,id:s._id||s.id};}

  // Modal State: Add Transaction
  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [txnForm, setTxnForm] = useState({customerId:"",type:"Udhaar",amount:"",description:"",paymentMethod:"Cash",billNumber:"",date:new Date().toISOString().split("T")[0]});
  // Modal State: Add Customer
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [custForm, setCustForm] = useState({name:"",countryCode:"+92",phone:"",email:"",address:"",openingBalance:""});

  if (loading && isAuthenticated) { return <div style={{padding:'40px',fontFamily:'sans-serif'}}>Loading HisabKitab...</div>; }

  if (!isAuthenticated || currentPage === "login") {
    return (
      <>
        <Toaster position="top-right" richColors closeButton />
        <Login onLogin={handleLogin} shopInfo={shopInfo} />
      </>
    );
  }

  // Titles for Header
  const pageTitles = {
    dashboard: {
      title: "Khata Dashboard",
    },
    customers: {
      title: "Customers Directory",
    },
    "customer-details": {
      title: "Customer Khata Ledger",
    },
    suppliers: {
      title: "Suppliers Directory",
    },
    "supplier-details": {
      title: "Supplier Details & Info",
    },
    transactions: {
      title: "Transaction Ledger",
    },
    reports: {
      title: "Financial Analytics & Reports",
    },
    settings: {
      title: "Profile & Store Settings",
    },
  };

  const currentHeaderInfo = pageTitles[currentPage] || pageTitles.dashboard;
  const activeCustomer = customers.find((c) => c.id === selectedCustomerId);
  const activeSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <DashboardLayout
        currentPage={currentPage}
        setCurrentPage={handleNavigate}
        shopInfo={shopInfo}
        onLogout={handleLogout}
        title={currentHeaderInfo.title}
        subtitle={currentHeaderInfo.subtitle}
        onQuickAddTransaction={() => handleOpenAddTransaction("Udhaar")}
      >
        {currentPage === "dashboard" && (
          <Dashboard
            customers={customers}
            transactions={transactions}
            suppliers={suppliers}
            supplierTransactions={supplierTransactions}
            onNavigate={handleNavigate}
            onOpenAddTransaction={handleOpenAddTransaction}
            onOpenAddCustomer={handleOpenAddCustomer}
            currency={shopInfo.currency}
          />
        )}

        {currentPage === "customers" && (
          <Customers
            customers={customers}
            onSelectCustomer={(id) => handleNavigate("customer-details", id)}
            onOpenAddCustomer={handleOpenAddCustomer}
            onOpenAddTransaction={handleOpenAddTransaction}
            currency={shopInfo.currency}
            initialStatusFilter={activeCustFilter}
          />
        )}

        {currentPage === "customer-details" && (
          <CustomerDetails
            customer={activeCustomer}
            transactions={transactions}
            onBack={() => handleNavigate("customers")}
            onOpenAddTransaction={handleOpenAddTransaction}
            currency={shopInfo.currency}
            shopInfo={shopInfo}
          />
        )}

        {currentPage === "suppliers" && (
          <Suppliers
            suppliers={suppliers}
            onSelectSupplier={(id) => handleNavigate("supplier-details", id)}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onToggleSupplierStatus={handleToggleSupplierStatus}
            currency={shopInfo.currency}
          />
        )}

        {currentPage === "supplier-details" && (
          <SupplierDetails
            supplier={activeSupplier}
            suppliers={suppliers}
            supplierTransactions={supplierTransactions}
            onBack={() => handleNavigate("suppliers")}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onToggleSupplierStatus={handleToggleSupplierStatus}
            onRecordPurchase={handleRecordPurchase}
            onMakePayment={handleMakePayment}
            currency={shopInfo.currency}
          />
        )}

        {currentPage === "transactions" && (
          <Transactions
            transactions={transactions}
            customers={customers}
            suppliers={suppliers}
            supplierTransactions={supplierTransactions}
            shopInfo={shopInfo}
            onSelectCustomer={(id) => handleNavigate("customer-details", id)}
            onSelectSupplier={(id) => handleNavigate("supplier-details", id)}
            onOpenAddTransaction={handleOpenAddTransaction}
            currency={shopInfo.currency}
            initialTypeFilter={activeTxnFilter}
          />
        )}

        {currentPage === "reports" && (
          <Reports
            customers={customers}
            transactions={transactions}
            suppliers={suppliers}
            supplierTransactions={supplierTransactions}
            currency={shopInfo.currency}
            shopInfo={shopInfo}
            onSelectCustomer={(id) => handleNavigate("customer-details", id)}
            onSelectSupplier={(id) => handleNavigate("supplier-details", id)}
          />
        )}

        {currentPage === "settings" && (
          <Settings
            shopInfo={shopInfo}
            onUpdateShopInfo={handleUpdateShopInfo}
          />
        )}
      </DashboardLayout>

      {/* Add Transaction Modal */}
      <Modal
        isOpen={txnModalOpen}
        onClose={() => setTxnModalOpen(false)}
        title={
          txnForm.type === "Udhaar"
            ? "Record Udhaar (Credit Given)"
            : "Record Jama (Payment Received)"
        }
      >
        <form onSubmit={handleSaveTransaction} className="modal-form">
          <div className="form-group">
            <label className="form-label">Transaction Type</label>
            <div className="type-toggle-group">
              <button
                type="button"
                className={`type-toggle-btn type-udhaar ${
                  txnForm.type === "Udhaar" ? "active" : ""
                }`}
                onClick={() =>
                  setTxnForm((prev) => ({
                    ...prev,
                    type: "Udhaar",
                    paymentMethod: "Khata Credit",
                    billNumber: generateUniqueReceiptNumber(transactions, "Udhaar"),
                  }))
                }
              >
                Udhaar (Debit)
              </button>
              <button
                type="button"
                className={`type-toggle-btn type-jama ${
                  txnForm.type === "Jama" ? "active" : ""
                }`}
                onClick={() =>
                  setTxnForm((prev) => ({
                    ...prev,
                    type: "Jama",
                    paymentMethod: "Cash",
                    billNumber: generateUniqueReceiptNumber(transactions, "Jama"),
                  }))
                }
              >
                Jama (Credit)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="txn-cust">
              Select Customer *
            </label>
            <select
              id="txn-cust"
              className="form-input"
              value={txnForm.customerId}
              onChange={(e) =>
                setTxnForm((prev) => ({ ...prev, customerId: e.target.value }))
              }
              required
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Balance: {shopInfo.currency} {c.balance})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="txn-amount">
                Amount ({shopInfo.currency}) *
              </label>
              <input
                id="txn-amount"
                type="number"
                min="1"
                step="any"
                className="form-input"
                placeholder="e.g. 2500"
                value={txnForm.amount}
                onChange={(e) =>
                  setTxnForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="txn-date">
                Date
              </label>
              <input
                id="txn-date"
                type="date"
                className="form-input"
                value={txnForm.date}
                onChange={(e) =>
                  setTxnForm((prev) => ({ ...prev, date: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="txn-method">
                Payment Channel
              </label>
              <select
                id="txn-method"
                className="form-input"
                value={txnForm.paymentMethod}
                onChange={(e) =>
                  setTxnForm((prev) => ({
                    ...prev,
                    paymentMethod: e.target.value,
                  }))
                }
              >
                <option value="Cash">Cash at Counter</option>
                <option value="EasyPaisa">EasyPaisa</option>
                <option value="JazzCash">JazzCash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Khata Credit">Khata Credit</option>
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="form-label" htmlFor="txn-bill" style={{ margin: 0 }}>
                  Bill / Receipt No.
                </label>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    padding: "0 2px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onClick={() => {
                    const freshSlip = generateUniqueReceiptNumber(transactions, txnForm.type);
                    setTxnForm((prev) => ({ ...prev, billNumber: freshSlip }));
                  }}
                  title="Regenerate a guaranteed unique receipt number"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  Generate Unique
                </button>
              </div>
              <input
                id="txn-bill"
                type="text"
                className="form-input"
                placeholder="e.g. REC-2042"
                value={txnForm.billNumber}
                onChange={(e) =>
                  setTxnForm((prev) => ({ ...prev, billNumber: e.target.value }))
                }
                style={
                  txnForm.billNumber && !isReceiptNumberUnique(txnForm.billNumber, transactions)
                    ? { borderColor: "#ef4444", background: "#fef2f2" }
                    : {}
                }
              />
              {txnForm.billNumber && !isReceiptNumberUnique(txnForm.billNumber, transactions) ? (
                <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px", fontWeight: "600" }}>
                  ⚠ Receipt #{txnForm.billNumber} is already used! Each receipt must be strictly unique.
                </div>
              ) : txnForm.billNumber ? (
                <div style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px" }}>
                  ✓ Guaranteed unique receipt number
                </div>
              ) : null}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="txn-desc">
              Description / Item Notes
            </label>
            <input
              id="txn-desc"
              type="text"
              className="form-input"
              placeholder="e.g. 5kg Sugar, 2L Cooking Oil"
              value={txnForm.description}
              onChange={(e) =>
                setTxnForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <div className="modal-actions-right">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTxnModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={txnForm.type === "Udhaar" ? "danger" : "success"}
            >
              Save {txnForm.type} Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Customer Modal */}
      <Modal
        isOpen={custModalOpen}
        onClose={() => setCustModalOpen(false)}
        title="Add New Customer Khata"
      >
        <form onSubmit={handleSaveCustomer} className="modal-form">
          <div className="form-group">
            <label className="form-label" htmlFor="cust-name">
              Full Customer Name (Letters Only) *
            </label>
            <input
              id="cust-name"
              type="text"
              className="form-input"
              placeholder="e.g. Tariq Mehmood"
              value={custForm.name}
              onChange={(e) => {
                const rawVal = e.target.value;
                const alphabetsOnly = rawVal.replace(/[^a-zA-Z\s]/g, "");
                setCustForm((prev) => ({ ...prev, name: alphabetsOnly }));
                if (rawVal !== alphabetsOnly) {
                  toast.warning("Numbers Not Allowed", {
                    description: "Customer name can only contain alphabetic letters and spaces.",
                  });
                }
              }}
              required
            />
            <span className="field-hint">Numbers and digits are not permitted.</span>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="cust-phone">
                Country Code & Phone Number *
              </label>
              <div className="phone-input-group">
                <select
                  className="country-code-select"
                  value={custForm.countryCode || "+92"}
                  onChange={(e) =>
                    setCustForm((prev) => ({ ...prev, countryCode: e.target.value }))
                  }
                  aria-label="Country Code"
                >
                  {COUNTRY_CODES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} ({item.country})
                    </option>
                  ))}
                </select>
                <input
                  id="cust-phone"
                  type="tel"
                  className="form-input phone-number-input"
                  placeholder="300-1234567"
                  value={custForm.phone}
                  onChange={(e) =>
                    setCustForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cust-opening">
                Opening Balance ({shopInfo.currency})
              </label>
              <input
                id="cust-opening"
                type="number"
                min="0"
                step="any"
                className="form-input"
                placeholder="0 if new account"
                value={custForm.openingBalance}
                onChange={(e) =>
                  setCustForm((prev) => ({
                    ...prev,
                    openingBalance: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cust-email">
              Email Address (For Automatic Transaction Slips)
            </label>
            <input
              id="cust-email"
              type="email"
              className="form-input"
              placeholder="e.g. customer@gmail.com (Optional)"
              value={custForm.email || ""}
              onChange={(e) =>
                setCustForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <span className="field-hint">Automatic transaction notifications branded Alam Garments will be sent to this email.</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cust-address">
              Shop / Home Address (Optional)
            </label>
            <input
              id="cust-address"
              type="text"
              className="form-input"
              placeholder="e.g. Street 4, Sector G-8, Islamabad"
              value={custForm.address}
              onChange={(e) =>
                setCustForm((prev) => ({ ...prev, address: e.target.value }))
              }
            />
          </div>

          <div className="modal-actions-right">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Customer Account
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}