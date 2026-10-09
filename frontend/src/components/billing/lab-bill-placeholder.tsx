/** Keeps Wilco's unselected bill template visible without enabling bill actions. */
export function LabBillPlaceholder({ mode }: { mode: "modify" | "dues" }) {
  return (
    <section className="lis-bill-placeholder" aria-label="Select a bill to load details">
      {mode === "modify" ? (
        <div className="lis-placeholder-tests">
          {['Departments', 'Lab Tests'].map((label) => (
            <div key={label}>
              <label>{label}</label>
              <input aria-label={`${label} search — select a bill first`} placeholder="Search..." disabled />
              <div className="lis-placeholder-list" />
            </div>
          ))}
          <div aria-hidden="true">»</div>
          <div>
            <label>Existed Lab Tests</label>
            <table><thead><tr>{['Delete', 'Dept Name', 'Lab Test Name', 'Amount', 'Qty', 'Total'].map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody /></table>
          </div>
        </div>
      ) : (
        <div className="lis-placeholder-items">
          <table><thead><tr>{['Name', 'Amount', 'Qty', 'Total'].map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody /></table>
        </div>
      )}
      <p className="lis-placeholder-hint">Select a bill to load its details.</p>
      <div className="lis-placeholder-payment">
        <label>Payment Mode <select aria-label="Payment Mode — select a bill first" disabled><option>Cash</option></select></label>
        <label>Comments <textarea aria-label="Comments — select a bill first" disabled /></label>
        <div>{['Total Amount', 'Enter Discount', 'Net Amount', mode === 'modify' ? 'Paid Amount' : 'Paying Amount', 'Balance Amount'].map((label) => <label key={label}>{label}<input aria-label={`${label} — select a bill first`} disabled /></label>)}</div>
      </div>
    </section>
  );
}
