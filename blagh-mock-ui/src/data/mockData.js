export const EMPLOYEES = [
  { id: 'EMP001', name: 'Admin User',      email: 'admin@csiconnect.com',    role: 'Administrator',      department: 'Information Technology', status: 'Active',   joined: '2020-01-15', avatar: 'AU' },
  { id: 'EMP042', name: 'Sarah Johnson',   email: 'sarah@csiconnect.com',    role: 'HR Manager',         department: 'Human Resources',        status: 'Active',   joined: '2020-03-22', avatar: 'SJ' },
  { id: 'EMP103', name: 'Michael Chen',    email: 'mchen@csiconnect.com',    role: 'Senior Developer',   department: 'Engineering',            status: 'Active',   joined: '2021-06-01', avatar: 'MC' },
  { id: 'EMP104', name: 'Priya Nair',      email: 'pnair@csiconnect.com',    role: 'UI/UX Designer',     department: 'Product',                status: 'Active',   joined: '2021-08-15', avatar: 'PN' },
  { id: 'EMP205', name: 'James Whitfield', email: 'jwhit@csiconnect.com',    role: 'Finance Analyst',    department: 'Finance',                status: 'On Leave', joined: '2019-11-10', avatar: 'JW' },
  { id: 'EMP206', name: 'Amara Osei',      email: 'aosei@csiconnect.com',    role: 'QA Engineer',        department: 'Engineering',            status: 'Active',   joined: '2022-02-01', avatar: 'AO' },
  { id: 'EMP307', name: 'Leila Hashemi',   email: 'lhash@csiconnect.com',    role: 'Product Manager',    department: 'Product',                status: 'Active',   joined: '2020-07-20', avatar: 'LH' },
  { id: 'EMP308', name: 'Tom Eriksson',    email: 'terik@csiconnect.com',    role: 'DevOps Engineer',    department: 'Information Technology', status: 'Active',   joined: '2021-12-05', avatar: 'TE' },
  { id: 'EMP409', name: 'Diana Flores',    email: 'dflor@csiconnect.com',    role: 'Sales Executive',    department: 'Sales',                  status: 'Inactive', joined: '2018-05-30', avatar: 'DF' },
  { id: 'EMP410', name: 'Ravi Kumar',      email: 'rkumar@csiconnect.com',   role: 'Backend Developer',  department: 'Engineering',            status: 'Active',   joined: '2023-01-09', avatar: 'RK' },
];

export const LEAVE_REQUESTS = [
  { id: 'LR-2026-001', employeeId: 'EMP042', employeeName: 'Sarah Johnson',   type: 'Annual Leave',  from: '2026-09-15', to: '2026-09-18', days: 4,  status: 'Pending',  applied: '2026-09-10', reason: 'Family vacation' },
  { id: 'LR-2026-002', employeeId: 'EMP205', employeeName: 'James Whitfield', type: 'Sick Leave',    from: '2026-09-08', to: '2026-09-12', days: 5,  status: 'Approved', applied: '2026-09-07', reason: 'Medical treatment' },
  { id: 'LR-2026-003', employeeId: 'EMP103', employeeName: 'Michael Chen',    type: 'Work From Home', from: '2026-09-11', to: '2026-09-11', days: 1,  status: 'Approved', applied: '2026-09-10', reason: 'Home repair' },
  { id: 'LR-2026-004', employeeId: 'EMP104', employeeName: 'Priya Nair',      type: 'Annual Leave',  from: '2026-09-22', to: '2026-09-26', days: 5,  status: 'Pending',  applied: '2026-09-09', reason: 'Personal trip' },
  { id: 'LR-2026-005', employeeId: 'EMP206', employeeName: 'Amara Osei',      type: 'Sick Leave',    from: '2026-09-03', to: '2026-09-04', days: 2,  status: 'Rejected', applied: '2026-09-02', reason: 'Not feeling well' },
  { id: 'LR-2026-006', employeeId: 'EMP307', employeeName: 'Leila Hashemi',   type: 'Annual Leave',  from: '2026-10-01', to: '2026-10-07', days: 7,  status: 'Pending',  applied: '2026-09-11', reason: 'Extended leave' },
  { id: 'LR-2026-007', employeeId: 'EMP308', employeeName: 'Tom Eriksson',    type: 'Work From Home', from: '2026-09-12', to: '2026-09-13', days: 2,  status: 'Approved', applied: '2026-09-10', reason: 'Remote site work' },
  { id: 'LR-2026-008', employeeId: 'EMP410', employeeName: 'Ravi Kumar',      type: 'Casual Leave',  from: '2026-09-18', to: '2026-09-18', days: 1,  status: 'Pending',  applied: '2026-09-11', reason: 'Personal errand' },
];

export const ANNOUNCEMENTS = [
  { id: 1, title: 'Office Closure — National Holiday',    date: '2026-09-12', priority: 'high',   body: 'The office will remain closed on September 14th for the National Holiday.' },
  { id: 2, title: 'Q3 All-Hands Meeting',                date: '2026-09-08', priority: 'medium', body: 'The Q3 all-hands meeting is scheduled for September 20th at 10:00 AM IST.' },
  { id: 3, title: 'New Leave Policy Effective Oct 2026',  date: '2026-09-05', priority: 'medium', body: 'Updated leave encashment rules will come into effect from October 1st, 2026.' },
];

export const STATS = {
  totalEmployees : EMPLOYEES.length,
  activeEmployees: EMPLOYEES.filter(e => e.status === 'Active').length,
  pendingLeaves  : LEAVE_REQUESTS.filter(l => l.status === 'Pending').length,
  approvedLeaves : LEAVE_REQUESTS.filter(l => l.status === 'Approved').length,
};
