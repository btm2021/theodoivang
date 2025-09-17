// Hàm format số tiền
function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount));
}

// Hàm format trọng lượng vàng (chỉ -> lượng, chỉ, phân)
function formatWeight(weightInChi) {
    const luong = Math.floor(weightInChi / 10);
    const chi = Math.floor(weightInChi % 10);
    const phan = Math.round((weightInChi % 1) * 10);

    let result = '';
    if (luong > 0) result += `${luong} lượng `;
    if (chi > 0) result += `${chi} chỉ `;
    if (phan > 0) result += `${phan} phân`;

    return result.trim() || '0 chỉ';
}

// Hàm tính toán quy đổi trọng lượng theo tuổi vàng
function convertWeight(originalWeight, originalAge, targetAge) {
    return (originalWeight * originalAge) / targetAge;
}

// Hàm tính toán giá trị vàng
function calculateValue(weight, price, unit) {
    let actualPricePerChi = price;

    // Chuyển đổi giá từ lượng sang chỉ nếu cần
    if (unit === 'vnd_luong') {
        actualPricePerChi = price / 10;
    }

    return weight * actualPricePerChi * 1000; // Nhân 100000 vì giá nhập dạng 6400 = 6.400.000
}

// Hàm tính phần trăm chênh lệch
function calculatePercentageDiff(newValue, originalValue) {
    return ((newValue - originalValue) / originalValue) * 100;
}

// Hàm kiểm tra đầu vào hợp lệ
function validateInputs() {
    const originalWeight = parseFloat(document.getElementById('originalWeight').value);
    const originalAge = parseInt(document.getElementById('originalAge').value);
    const originalPrice = parseFloat(document.getElementById('originalPrice').value);
    const newAge = parseInt(document.getElementById('newAge').value);
    const newPrice = parseFloat(document.getElementById('newPrice').value);

    return originalWeight > 0 && originalAge > 0 && originalPrice > 0 && newAge > 0 && newPrice > 0;
}

// Hàm lấy ngày giờ hiện tại
function getCurrentDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString('vi-VN');
    const time = now.toLocaleTimeString('vi-VN');
    return { date, time };
}

// Hàm tạo phiếu báo giá chi tiết với width lớn hơn
function createComparisonResult(originalData, convertedData) {
    const valueDiff = convertedData.value - originalData.value;
    const percentageDiff = calculatePercentageDiff(convertedData.value, originalData.value);
    const { date, time } = getCurrentDateTime();

    const isPositive = valueDiff >= 0;
    const diffColor = isPositive ? 'text-green-700' : 'text-red-700';
    const diffBg = isPositive ? 'bg-green-100' : 'bg-red-100';
    const statusText = isPositive ? 'CÓ LỢI' : 'KHÔNG CÓ LỢI';

    const goldPurity = {
        [originalData.age]: (originalData.age / 1000 * 100).toFixed(1),
        [convertedData.age]: (convertedData.age / 1000 * 100).toFixed(1)
    };

    const weightDiff = convertedData.weight - originalData.weight;

    return `
        <div class="h-full p-1">
            <div class="bg-white border-3 border-gray-800 w-full h-full flex flex-col" style="font-family: 'Times New Roman', serif;">
                <!-- Header compact -->
                <div class="text-center border-b-2 border-gray-800 py-1 bg-gradient-to-r from-yellow-100 to-yellow-200 flex-shrink-0">
                    <h1 class="text-lg font-bold text-gray-800">PHIẾU BÁO GIÁ VÀNG CHI TIẾT</h1>
                    <div class="text-xs text-gray-500 flex justify-center space-x-4">
                        <span>📅 ${date}</span>
                        <span>�  ${time}</span>
                    </div>
                </div>

                <!-- Main content grid -->
                <div class="grid grid-cols-4 gap-0 flex-1 overflow-hidden">
                    <!-- Cột 1: Vàng gốc -->
                    <div class="border-r border-gray-800">
                        <div class="bg-gray-200 px-2 py-1 border-b border-gray-600">
                            <h3 class="text-sm font-bold text-gray-800">📊 VÀNG GỐC</h3>
                        </div>
                        <div class="p-2 space-y-2 text-xs">
                            <div class="bg-blue-50 p-2 border">
                                <div class="text-gray-600">Trọng lượng</div>
                                <div class="font-bold text-blue-700">${formatWeight(originalData.weight)}</div>
                                <div class="text-xs text-gray-500">${originalData.weight.toFixed(2)} chỉ</div>
                            </div>
                            <div class="bg-purple-50 p-2 border">
                                <div class="text-gray-600">Tuổi vàng</div>
                                <div class="font-bold text-purple-700">${originalData.age}</div>
                                <div class="text-xs text-gray-500">${goldPurity[originalData.age]}% tinh khiết</div>
                            </div>
                            <div class="bg-green-50 p-2 border">
                                <div class="text-gray-600">Đơn giá</div>
                                <div class="font-bold text-green-700">${formatMoney(originalData.pricePerUnit)}</div>
                                <div class="text-xs text-gray-500">VNĐ/chỉ</div>
                            </div>
                            <div class="bg-yellow-50 p-2 border">
                                <div class="text-gray-600">Tổng giá trị</div>
                                <div class="font-bold text-yellow-700">${formatMoney(originalData.value)}</div>
                                <div class="text-xs text-gray-500">VNĐ</div>
                            </div>
                        </div>
                    </div>

                    <!-- Cột 2: Sau quy đổi -->
                    <div class="border-r border-gray-800">
                        <div class="bg-orange-200 px-2 py-1 border-b border-gray-600">
                            <h3 class="text-sm font-bold text-gray-800">🔄 SAU QUY ĐỔI</h3>
                        </div>
                        <div class="p-2 space-y-2 text-xs">
                            <div class="bg-blue-50 p-2 border">
                                <div class="text-gray-600">Trọng lượng mới</div>
                                <div class="font-bold text-blue-700">${formatWeight(convertedData.weight)}</div>
                                <div class="text-xs text-gray-500">${convertedData.weight.toFixed(2)} chỉ</div>
                            </div>
                            <div class="bg-purple-50 p-2 border">
                                <div class="text-gray-600">Tuổi vàng mới</div>
                                <div class="font-bold text-purple-700">${convertedData.age}</div>
                                <div class="text-xs text-gray-500">${goldPurity[convertedData.age]}% tinh khiết</div>
                            </div>
                            <div class="bg-green-50 p-2 border">
                                <div class="text-gray-600">Đơn giá mới</div>
                                <div class="font-bold text-green-700">${formatMoney(convertedData.pricePerUnit)}</div>
                                <div class="text-xs text-gray-500">VNĐ/chỉ</div>
                            </div>
                            <div class="bg-yellow-50 p-2 border">
                                <div class="text-gray-600">Tổng giá trị mới</div>
                                <div class="font-bold text-yellow-700">${formatMoney(convertedData.value)}</div>
                                <div class="text-xs text-gray-500">VNĐ</div>
                            </div>
                        </div>
                    </div>

                    <!-- Cột 3: Công thức tính -->
                    <div class="border-r border-gray-800">
                        <div class="bg-blue-200 px-2 py-1 border-b border-gray-600">
                            <h3 class="text-sm font-bold text-gray-800">🧮 CÔNG THỨC</h3>
                        </div>
                        <div class="p-2 space-y-1 text-xs overflow-y-auto">
                            <div class="bg-white p-1 border-l-2 border-blue-500">
                                <div class="font-bold text-blue-700">1. Quy đổi TL:</div>
                                <div class="text-gray-700">
                                    ${originalData.weight} × ${originalData.age} ÷ ${convertedData.age}<br>
                                    = <strong>${convertedData.weight.toFixed(2)} chỉ</strong>
                                </div>
                            </div>
                            <div class="bg-white p-1 border-l-2 border-green-500">
                                <div class="font-bold text-green-700">2. Giá trị gốc:</div>
                                <div class="text-gray-700">
                                    ${originalData.weight} × ${formatMoney(originalData.pricePerUnit)}<br>
                                    = <strong>${formatMoney(originalData.value)} VNĐ</strong>
                                </div>
                            </div>
                            <div class="bg-white p-1 border-l-2 border-orange-500">
                                <div class="font-bold text-orange-700">3. Giá trị mới:</div>
                                <div class="text-gray-700">
                                    ${convertedData.weight.toFixed(2)} × ${formatMoney(convertedData.pricePerUnit)}<br>
                                    = <strong>${formatMoney(convertedData.value)} VNĐ</strong>
                                </div>
                            </div>
                            <div class="bg-white p-1 border-l-2 border-red-500">
                                <div class="font-bold text-red-700">4. Chênh lệch:</div>
                                <div class="text-gray-700">
                                    ${formatMoney(convertedData.value)} - ${formatMoney(originalData.value)}<br>
                                    = <strong>${isPositive ? '+' : ''}${formatMoney(valueDiff)} VNĐ</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Cột 4: Kết quả -->
                    <div class="${diffBg}">
                        <div class="bg-gray-800 text-white px-2 py-1 text-center">
                            <h3 class="text-sm font-bold">📈 KẾT QUẢ</h3>
                        </div>
                        <div class="p-2 text-center">
                            <div class="${diffColor} text-2xl font-bold mb-1">
                                ${isPositive ? '+' : ''}${formatMoney(valueDiff)}
                            </div>
                            <div class="${diffColor} text-sm font-bold mb-2">
                                (${isPositive ? '+' : ''}${percentageDiff.toFixed(2)}%)
                            </div>
                            
                            <div class="space-y-1 text-xs mb-2">
                                <div class="bg-white p-1 border">
                                    <div class="text-gray-600">Chênh lệch TL</div>
                                    <div class="font-bold ${weightDiff >= 0 ? 'text-green-600' : 'text-red-600'}">
                                        ${weightDiff >= 0 ? '+' : ''}${weightDiff.toFixed(2)} chỉ
                                    </div>
                                </div>
                                <div class="bg-white p-1 border">
                                    <div class="text-gray-600">Chênh lệch giá</div>
                                    <div class="font-bold ${convertedData.pricePerUnit >= originalData.pricePerUnit ? 'text-green-600' : 'text-red-600'}">
                                        ${convertedData.pricePerUnit >= originalData.pricePerUnit ? '+' : ''}${formatMoney(convertedData.pricePerUnit - originalData.pricePerUnit)}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="border-2 ${isPositive ? 'border-green-600' : 'border-red-600'} ${diffBg} p-2">
                                <div class="${diffColor} font-bold text-sm">
                                    🎯 ${statusText}
                                </div>
                                <div class="text-xs text-gray-700 mt-1">
                                    ${isPositive ? '✅ Có lợi nhuận' : '⚠️ Sẽ bị lỗ'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer compact -->
                <div class="text-center py-1 border-t border-gray-800 bg-gray-50 flex-shrink-0">
                    <p class="text-xs text-gray-600">
                        📋 Phiếu tham khảo - Giá vàng có thể thay đổi | Hệ thống tính toán chuẩn ngành vàng bạc
                    </p>
                </div>
            </div>
        </div>
    `;
}

// Hàm tính toán và hiển thị kết quả
function calculateConversion() {
    // Kiểm tra đầu vào
    if (!validateInputs()) {
        document.getElementById('comparisonResult').innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <p class="text-sm">Vui lòng nhập đầy đủ thông tin hợp lệ</p>
            </div>
        `;
        return;
    }

    // Lấy dữ liệu từ form
    const originalWeight = parseFloat(document.getElementById('originalWeight').value);
    const originalAge = parseInt(document.getElementById('originalAge').value);
    const originalPrice = parseFloat(document.getElementById('originalPrice').value);
    const newAge = parseInt(document.getElementById('newAge').value);
    const newPrice = parseFloat(document.getElementById('newPrice').value);
    const priceUnit = document.getElementById('priceUnit').value;

    // Tính toán dữ liệu gốc
    const originalValue = calculateValue(originalWeight, originalPrice, priceUnit);
    const originalData = {
        weight: originalWeight,
        age: originalAge,
        pricePerUnit: originalPrice * 1000,
        value: originalValue
    };

    // Tính toán dữ liệu sau quy đổi
    const convertedWeight = convertWeight(originalWeight, originalAge, newAge);
    const convertedValue = calculateValue(convertedWeight, newPrice, priceUnit);
    const convertedData = {
        weight: convertedWeight,
        age: newAge,
        pricePerUnit: newPrice * 1000,
        value: convertedValue
    };

    // Tạo và hiển thị kết quả
    const resultsContainer = document.getElementById('comparisonResult');
    resultsContainer.innerHTML = createComparisonResult(originalData, convertedData);
}

// Hàm tự động tính toán khi có thay đổi
function autoCalculate() {
    if (validateInputs()) {
        document.getElementById('autoCalculateStatus').classList.remove('hidden');
        calculateConversion();
    } else {
        document.getElementById('autoCalculateStatus').classList.add('hidden');
        document.getElementById('comparisonResult').innerHTML = `
            <div class="h-full flex items-center justify-center">
                <div class="text-center text-gray-400">
                    <p class="text-sm">Nhập đầy đủ thông tin để xem phiếu báo giá</p>
                </div>
            </div>
        `;
    }
}



// Thêm event listener cho tự động tính toán
document.addEventListener('DOMContentLoaded', function () {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', autoCalculate);
        input.addEventListener('change', autoCalculate);
    });

    // Hiển thị trạng thái ban đầu
    autoCalculate();
});