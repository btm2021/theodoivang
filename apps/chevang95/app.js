new Vue({
    el: '#app',
    data: {
        inputWeight: 1000,
        customPurity: null
    },
    methods: {
        calculateWeight(targetPurity) {
            if (!this.inputWeight || this.inputWeight <= 0) {
                return '0 chỉ 0 phân 0 li 0 gem';
            }
            
            // Công thức: Trọng lượng cần chế = (Trọng lượng vàng 950 × 950) / Tuổi vàng đích
            const resultUnits = Math.round((this.inputWeight * 950) / targetPurity);
            
            return this.formatWeight(resultUnits);
        },
        formatWeight(totalUnits) {
            // Quy đổi: 1000 đơn vị = 1 chỉ
            // Format: 20.213 chỉ = 20c213
            const chi = Math.floor(totalUnits / 1000);
            const decimal = totalUnits % 1000;
            
            return `${chi}c${decimal.toString().padStart(3, '0')}`;
        },
        formatInputWeight() {
            if (!this.inputWeight || this.inputWeight <= 0) {
                return '0c000';
            }
            return this.formatWeight(this.inputWeight);
        }
    }
});
