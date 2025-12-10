

function calculatePayrollForEmployee(getDb, dbContext, employeeId, startDate, endDate) {
    const db = getDb();
    const employee = dbContext.getById('employees', employeeId);
    if (!employee) throw new Error(`لم يتم العثور على الموظف صاحب المعرف ${employeeId}.`);

    const workdaysSetting = dbContext.getSettings('workdays');
    const workdays = workdaysSetting ? JSON.parse(workdaysSetting.value) : [0, 1, 2, 3, 4];
    
    // Check if employee is in Manufacturing Staff to apply flat rate logic
    const manufacturingProfile = db.prepare('SELECT * FROM manufacturing_staff WHERE employeeId = ?').get(employeeId);
    const isManufacturing = !!manufacturingProfile;

    // Fetch Schedule History
    const scheduleHistory = db.prepare('SELECT * FROM work_schedule_history WHERE employeeId = ? ORDER BY startDate DESC').all(employeeId);

    // Helper to get agreed hours for a specific date
    const getAgreedHoursForDate = (dateStr) => {
        // Find the first record where startDate <= dateStr
        // Since list is sorted DESC by startDate, the first match is the effective schedule
        const schedule = scheduleHistory.find(s => s.startDate <= dateStr);
        return schedule ? schedule.hours : (employee.agreedDailyHours || 8);
    };

    // 1. Attendance Data
    const employeeAttendance = db.prepare('SELECT * FROM attendance WHERE employeeId = ? AND date >= ? AND date <= ?').all(employeeId, startDate, endDate);
    
    // 2. Advances (السلف) - Fetch ALL approved outstanding advances regardless of currency/date
    const outstandingAdvances = db.prepare("SELECT * FROM salaryAdvances WHERE employeeId = ? AND status = 'Approved'").all(employeeId);
    
    // IMPORTANT: 'advancesTotal' is 0 because deduction happens manually via UI checkboxes in the Payroll screen.
    const advancesTotal = 0;
    
    // 3. Bonuses (المكافآت)
    const employeeBonuses = db.prepare("SELECT * FROM bonuses WHERE employeeId = ? AND date >= ? AND date <= ?").all(employeeId, startDate, endDate);
    const bonusesTotal = employeeBonuses.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    
    // 4. Deductions (الخصومات)
    const employeeDeductions = db.prepare("SELECT * FROM deductions WHERE employeeId = ? AND date >= ? AND date <= ?").all(employeeId, startDate, endDate);
    const manualDeductionsTotal = employeeDeductions.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    
    // 5. Leaves
    const leaveRequests = db.prepare("SELECT * FROM leaveRequests WHERE employeeId = ? AND status = 'Approved'").all(employeeId);

    // --- Calculation Logic ---
    let totalLateMinutes = 0;
    let totalWorkedHours = 0;
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;

    employeeAttendance.forEach(att => {
        // Lateness calculation
        if (employee.checkInEndTime && att.checkIn && att.checkIn > employee.checkInEndTime) {
            const actualCheckInTime = new Date(`${att.date}T${att.checkIn}`).getTime();
            const lateThresholdTime = new Date(`${att.date}T${employee.checkInEndTime}`).getTime();
            totalLateMinutes += Math.max(0, (actualCheckInTime - lateThresholdTime) / 60000);
        }

        if (att.checkIn && att.checkOut) {
            let effectiveCheckInString = att.checkIn;
            // Apply check-in grace period rounding
            if (employee.checkInStartTime && employee.checkInEndTime && att.checkIn > employee.checkInStartTime && att.checkIn <= employee.checkInEndTime) {
                effectiveCheckInString = employee.checkInStartTime;
            }

            const effectiveCheckInTime = new Date(`${att.date}T${effectiveCheckInString}`).getTime();
            let actualCheckOutTime = new Date(`${att.date}T${att.checkOut}`).getTime();
            
            // Handle overnight shifts
            if (actualCheckOutTime <= effectiveCheckInTime) {
                actualCheckOutTime += 24 * 60 * 60 * 1000;
            }

            const dailyDuration = Math.max(0, (actualCheckOutTime - effectiveCheckInTime) / 3600000);
            totalWorkedHours += dailyDuration;

            // DYNAMIC: Get agreed hours for THIS specific date from history
            const dailyAgreedHours = getAgreedHoursForDate(att.date);

            let dailyOvertime = 0;
            if (employee.checkOutEndTime) {
                let overtimeThresholdTime = new Date(`${att.date}T${employee.checkOutEndTime}`).getTime();
                if (overtimeThresholdTime <= effectiveCheckInTime) {
                    overtimeThresholdTime += 24 * 60 * 60 * 1000;
                }
                const overtimeMs = Math.max(0, actualCheckOutTime - overtimeThresholdTime);
                dailyOvertime = overtimeMs / 3600000;
            } else {
                dailyOvertime = Math.max(0, dailyDuration - dailyAgreedHours);
            }
            
            totalOvertimeHours += dailyOvertime;
            totalRegularHours += dailyDuration - dailyOvertime;
        }
    });

    let latenessDeductions = 0;
    let overtimePay = 0;
    let absenceAndUnpaidLeaveDeductions = 0;
    let effectiveHourlyRate = 0;
    const employeeWorkdaysSet = new Set((employee.workdays && employee.workdays.length > 0) ? employee.workdays : workdays);
    const startOfPeriod = new Date(startDate);
    const endOfPeriod = new Date(endDate);

    // Rate Calculation
    // Note: Rate is currently static based on current profile. 
    // Ideally, rate history should also be implemented, but scope is currently on Hours.
    if (employee.paymentType === 'hourly') {
        effectiveHourlyRate = employee.hourlyRate || 0;
    } else if ((employee.paymentType === 'monthly' || employee.paymentType === 'weekly') && employee.hourlyRate > 0) {
        effectiveHourlyRate = employee.hourlyRate;
    } else if (employee.paymentType === 'monthly') {
        let divisor = 0;
        if (employee.calculateSalaryBy30Days) {
            divisor = 30;
        } else {
            const year = startOfPeriod.getFullYear();
            const month = startOfPeriod.getMonth();
            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);
            for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
                if (employeeWorkdaysSet.has(d.getDay())) divisor++;
            }
        }
        const dailyRate = divisor > 0 ? (employee.monthlySalary || 0) / divisor : 0;
        // Use current agreed hours for rate base calculation (standard assumption)
        effectiveHourlyRate = employee.agreedDailyHours > 0 ? dailyRate / employee.agreedDailyHours : 0;
    } else if (employee.paymentType === 'weekly') {
        const divisor = employee.calculateSalaryBy30Days ? 7 : employeeWorkdaysSet.size;
        const dailyRate = divisor > 0 ? (employee.weeklySalary || 0) / divisor : 0;
        effectiveHourlyRate = employee.agreedDailyHours > 0 ? dailyRate / employee.agreedDailyHours : 0;
    }

    // Overtime
    const overtimeMultiplier = employee.overtimeRate > 0 ? employee.overtimeRate : 1.5;
    const finalOvertimeRate = effectiveHourlyRate * overtimeMultiplier;
    overtimePay = totalOvertimeHours * finalOvertimeRate;

    // Lateness
    if (employee.latenessDeductionRate > 0) {
        latenessDeductions = totalLateMinutes * employee.latenessDeductionRate;
    } else if (effectiveHourlyRate > 0) {
        latenessDeductions = totalLateMinutes * (effectiveHourlyRate / 60);
    }

    // Absence & Unpaid Leaves
    if (employee.paymentType === 'monthly' || employee.paymentType === 'weekly') {
        let daysToDeduct = 0;
        // Using current profile agreed hours for deduction rate calculation to maintain salary consistency
        const dailyRate = effectiveHourlyRate * (employee.agreedDailyHours || 8);
        
        const attendedDays = new Set(employeeAttendance.map(a => a.date));
        const onLeaveDays = new Set();
        
        leaveRequests.forEach(leave => {
            for (let d = new Date(leave.startDate); d <= new Date(leave.endDate); d.setDate(d.getDate() + 1)) {
                if (d >= startOfPeriod && d <= endOfPeriod) {
                    onLeaveDays.add(d.toISOString().split('T')[0]);
                }
            }
        });

        if (employee.calculateSalaryBy30Days) {
            const deductibleLeaves = leaveRequests.filter(lr => lr.type === 'Unpaid' || lr.deductFromSalary);
            deductibleLeaves.forEach(leave => {
                for (let d = new Date(leave.startDate); d <= new Date(leave.endDate); d.setDate(d.getDate() + 1)) {
                    if (d >= startOfPeriod && d <= endOfPeriod) daysToDeduct++;
                }
            });
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let d = new Date(startOfPeriod); d <= endOfPeriod; d.setDate(d.getDate() + 1)) {
                if (d > today) continue;

                if (employeeWorkdaysSet.has(d.getDay())) {
                    const dateStr = d.toISOString().split('T')[0];
                    if (!attendedDays.has(dateStr) && !onLeaveDays.has(dateStr)) {
                        daysToDeduct++;
                    }
                }
            }
            const deductibleLeaves = leaveRequests.filter(lr => lr.type === 'Unpaid' || lr.deductFromSalary);
            const uniqueDeductibleDays = new Set();
            deductibleLeaves.forEach(leave => {
                for (let d = new Date(leave.startDate); d <= new Date(leave.endDate); d.setDate(d.getDate() + 1)) {
                    if (d >= startOfPeriod && d <= endOfPeriod && employeeWorkdaysSet.has(d.getDay())) {
                        const dateStr = d.toISOString().split('T')[0];
                        if (onLeaveDays.has(dateStr)) uniqueDeductibleDays.add(dateStr);
                    }
                }
            });
            daysToDeduct += uniqueDeductibleDays.size;
        }
        absenceAndUnpaidLeaveDeductions = daysToDeduct * dailyRate;
    }
    
    // Base Salary Calculation
    let baseSalary = 0;
    if (isManufacturing) {
        // --- MANUFACTURING LOGIC OVERRIDE ---
        // Manufacturing staff gets a flat salary.
        // No deductions for lateness or absence (assumed flat/piecework nature based on request).
        // No overtime pay.
        baseSalary = manufacturingProfile.flatSalary;
        overtimePay = 0;
        latenessDeductions = 0;
        absenceAndUnpaidLeaveDeductions = 0; 
    } else if (employee.paymentType === 'hourly') {
        baseSalary = totalRegularHours * effectiveHourlyRate;
    } else if (employee.paymentType === 'weekly') {
        const durationInDays = (endOfPeriod.getTime() - startOfPeriod.getTime()) / (1000 * 3600 * 24) + 1;
        const numberOfWeeks = durationInDays / 7;
        baseSalary = (employee.weeklySalary || 0) * numberOfWeeks;
    } else {
        baseSalary = employee.monthlySalary || 0;
    }

    const totalDeductions = latenessDeductions + absenceAndUnpaidLeaveDeductions + manualDeductionsTotal;
    // Note: bonusesTotal and manualDeductionsTotal now include ALL currencies summed together numerically.
    const netSalary = baseSalary + overtimePay + bonusesTotal - totalDeductions;

    return {
        baseSalary, overtimePay, bonusesTotal, latenessDeductions,
        unpaidLeaveDeductions: absenceAndUnpaidLeaveDeductions,
        manualDeductionsTotal, advancesTotal, totalDeductions, netSalary,
        totalWorkedHours, totalRegularHours, totalOvertimeHours, totalLateMinutes,
        outstandingAdvances // Passed to frontend to display pending advances
    };
}


module.exports = (getDb, dbContext) => ({
    calculatePayrollForEmployee: (employeeId, startDate, endDate) => {
        return calculatePayrollForEmployee(getDb, dbContext, employeeId, startDate, endDate);
    },

    deliverSalary: ({ employeeId, year, month, weekNumber, advanceIdsToDeduct = [] }) => {
        const db = getDb();
        try {
            let paymentRecord = null;
            db.transaction(() => {
                const employee = dbContext.getById('employees', employeeId);
                if (!employee) throw new Error('لم يتم العثور على الموظف.');

                const monthStr = String(month).padStart(2, '0');
                const startDate = `${year}-${monthStr}-01`;
                const endDate = new Date(year, month, 0).toISOString().split('T')[0];

                let grossAmount, netAmount;
                let advancesDeducted = 0;

                if (employee.paymentType === 'weekly' && weekNumber) {
                    grossAmount = employee.weeklySalary || 0;
                    netAmount = grossAmount;
                } else {
                    const calculated = calculatePayrollForEmployee(getDb, dbContext, employeeId, startDate, endDate);
                    
                    if (advanceIdsToDeduct.length > 0) {
                        const placeholders = advanceIdsToDeduct.map(() => '?').join(',');
                        const advancesToDeduct = db.prepare(`SELECT amount FROM salaryAdvances WHERE id IN (${placeholders})`).all(...advanceIdsToDeduct);
                        advancesDeducted = advancesToDeduct.reduce((sum, adv) => sum + adv.amount, 0);
                    }

                    grossAmount = calculated.baseSalary + calculated.overtimePay + calculated.bonusesTotal;
                    netAmount = grossAmount - calculated.totalDeductions - advancesDeducted;
                }

                const result = db.prepare(`INSERT INTO payments (employeeId, year, month, weekNumber, paymentType, grossAmount, advancesDeducted, netAmount, paymentDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(employeeId, year, month, weekNumber || null, employee.paymentType, grossAmount, advancesDeducted, netAmount, new Date().toISOString());
                paymentRecord = dbContext.getById('payments', result.lastInsertRowid);
                
                if (employee.paymentType !== 'weekly') {
                    const attendanceIds = db.prepare('SELECT id FROM attendance WHERE employeeId = ? AND date LIKE ? AND (isPaid IS NULL OR isPaid = 0)').all(employeeId, `${year}-${monthStr}%`).map(r => r.id);
                    if (attendanceIds.length > 0) {
                        db.prepare(`UPDATE attendance SET isPaid = 1 WHERE id IN (${attendanceIds.map(()=>'?').join(',')})`).run(...attendanceIds);
                    }
                }
                
                if (advanceIdsToDeduct.length > 0) {
                    const updateStmt = db.prepare('UPDATE salaryAdvances SET status = ? WHERE id = ?');
                    for (const id of advanceIdsToDeduct) {
                        updateStmt.run('Paid', id);
                    }
                }
            })();
            return { success: true, message: 'تم تسليم الراتب بنجاح.', payment: paymentRecord };
        } catch (error) {
            console.error('Error delivering salary in DB module:', error);
            return { success: false, message: `فشل تسليم الراتب: ${error.message}` };
        }
    }
});
