/**
 * AI Triathlon Coach - ツールチップ機能
 * 指標をクリックすると説明を表示
 */

(function() {
    'use strict';

    // ツールチップ要素
    let tooltipElement = null;
    let currentTarget = null;
    let hideTimeout = null;

    /**
     * ツールチップを初期化
     */
    function initTooltip() {
        // ツールチップ要素を作成
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'metric-tooltip';
        tooltipElement.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon"></span>
                <div>
                    <div class="tooltip-title"></div>
                    <div class="tooltip-equivalent"></div>
                </div>
            </div>
            <div class="tooltip-body"></div>
            <a href="help.html" class="tooltip-link">
                詳しく見る →
            </a>
        `;
        document.body.appendChild(tooltipElement);

        // ツールチップからマウスが出たとき
        tooltipElement.addEventListener('mouseleave', function() {
            hideTooltip();
        });

        // ツールチップにマウスが入ったとき（非表示をキャンセル）
        tooltipElement.addEventListener('mouseenter', function() {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        });

        // イベントデリゲーション
        document.addEventListener('click', handleClick);
        document.addEventListener('mouseenter', handleMouseEnter, true);
        document.addEventListener('mouseleave', handleMouseLeave, true);

        // クリックでツールチップを閉じる
        document.addEventListener('click', function(e) {
            if (tooltipElement.classList.contains('visible') && 
                !tooltipElement.contains(e.target) && 
                !e.target.closest('[data-metric]')) {
                hideTooltip();
            }
        });
    }

    /**
     * クリックイベント処理
     */
    function handleClick(e) {
        const target = e.target.closest('[data-metric]');
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();

        if (currentTarget === target && tooltipElement.classList.contains('visible')) {
            hideTooltip();
        } else {
            showTooltip(target);
        }
    }

    /**
     * マウスエンター処理（ホバーでも表示）
     */
    function handleMouseEnter(e) {
        const target = e.target.closest('[data-metric]');
        if (!target) return;

        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        // 少し遅延して表示（誤操作防止）
        target._hoverTimeout = setTimeout(function() {
            showTooltip(target);
        }, 300);
    }

    /**
     * マウスリーブ処理
     */
    function handleMouseLeave(e) {
        const target = e.target.closest('[data-metric]');
        if (!target) return;

        if (target._hoverTimeout) {
            clearTimeout(target._hoverTimeout);
        }

        // 少し遅延して非表示（ツールチップへの移動を許可）
        hideTimeout = setTimeout(function() {
            if (currentTarget === target) {
                hideTooltip();
            }
        }, 200);
    }

    /**
     * ツールチップを表示
     */
    function showTooltip(target) {
        const metricKey = target.getAttribute('data-metric');
        const metricData = window.METRICS_DATA ? window.METRICS_DATA[metricKey] : null;

        if (!metricData) {
            console.warn('Metric data not found:', metricKey);
            return;
        }

        currentTarget = target;

        // 内容を設定
        tooltipElement.querySelector('.tooltip-icon').textContent = metricData.icon;
        tooltipElement.querySelector('.tooltip-title').textContent = metricData.name;
        tooltipElement.querySelector('.tooltip-equivalent').textContent = 
            '≒ ' + metricData.equivalent;
        tooltipElement.querySelector('.tooltip-body').textContent = metricData.shortDesc;
        tooltipElement.querySelector('.tooltip-link').href = 'help.html#' + metricKey;

        // 位置を計算
        positionTooltip(target);

        // 表示
        tooltipElement.classList.add('visible');
    }

    /**
     * ツールチップの位置を計算
     */
    function positionTooltip(target) {
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 12;

        // 矢印クラスをリセット
        tooltipElement.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');

        let top, left;

        // デフォルト: 下に表示
        top = targetRect.bottom + margin;
        left = targetRect.left + (targetRect.width / 2) - (tooltipElement.offsetWidth / 2);

        // 下に収まらない場合は上に
        if (top + tooltipElement.offsetHeight > viewportHeight - margin) {
            top = targetRect.top - tooltipElement.offsetHeight - margin;
            tooltipElement.classList.add('arrow-bottom');
        } else {
            tooltipElement.classList.add('arrow-top');
        }

        // 左右の調整
        if (left < margin) {
            left = margin;
        } else if (left + tooltipElement.offsetWidth > viewportWidth - margin) {
            left = viewportWidth - tooltipElement.offsetWidth - margin;
        }

        tooltipElement.style.top = top + 'px';
        tooltipElement.style.left = left + 'px';
    }

    /**
     * ツールチップを非表示
     */
    function hideTooltip() {
        tooltipElement.classList.remove('visible');
        currentTarget = null;
    }

    /**
     * 指標要素にツールチップ属性を追加するヘルパー
     * 使用例: addMetricTooltip(element, 'fitness');
     */
    window.addMetricTooltip = function(element, metricKey) {
        element.setAttribute('data-metric', metricKey);
        element.classList.add('has-tooltip');
    };

    /**
     * 複数の要素にツールチップを追加
     * 使用例: initMetricTooltips({ '#fitnessValue': 'fitness', '#fatigueValue': 'fatigue' });
     */
    window.initMetricTooltips = function(mappings) {
        Object.entries(mappings).forEach(function([selector, metricKey]) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(function(el) {
                window.addMetricTooltip(el, metricKey);
            });
        });
    };

    // DOMContentLoaded で初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTooltip);
    } else {
        initTooltip();
    }
})();
