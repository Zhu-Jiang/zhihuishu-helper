// ==UserScript==
// @name         智慧树讨论区自动发帖助手 (Agnes)
// @namespace    http://tampermonkey.net/
// @version      33.0
// @description  自动在智慧树讨论区发提问/发回答，内容由 Agnes 3.0 Flash 生成。使用前需自填 API Key。
// @author       Assistant
// @match        *://*.zhihuishu.com/*
// @grant        GM_xmlhttpRequest
// @connect      apihub.agnes-ai.com
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区域 =================
    const API_KEY = ''; // ← 在这里填入你的 Agnes API Key
    const API_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';
    const MODEL_NAME = 'agnes-3.0-flash';
    const MAX_WAIT_AFTER_PUBLISH = 15000;
    const AUTO_CLOSE_AFTER_ANSWER = true;
    const CLOSE_DELAY = 1500;
    // ============================================

    let isProcessing = false;
    let lastDialogState = false;

    function createControlPanel() {
        if (document.getElementById('tm-control-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'tm-control-panel';
        panel.style.cssText = `position: fixed; bottom: 80px; left: 20px; z-index: 2147483647; background: rgba(20, 20, 20, 0.95); color: #fff; padding: 15px; border-radius: 10px; font-family: sans-serif; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.8); border: 2px solid #00e676; display: flex; flex-direction: column; gap: 8px; pointer-events: none !important;`;
        panel.innerHTML = `
            <div style="font-weight: bold; font-size: 16px; border-bottom: 1px solid #555; padding-bottom: 5px;">🤖 讨论区助手 (Agnes)</div>
            <div style="color: #00e676;">▶ 详情页：按 Alt+X 全自动回答</div>
            <div style="color: #ff9800;">▶ 列表页：手动点蓝笔自动提问</div>
            <div id="tm-status" style="font-size: 13px; color: #1890ff; margin-top: 5px; font-weight: bold;">状态: 待机中</div>
        `;
        document.body.appendChild(panel);
    }

    function updateStatus(msg) {
        const s = document.getElementById('tm-status');
        if (s) s.innerText = '状态: ' + msg;
        console.log('助手状态: ' + msg);
    }

    function showToast(msg, isError = false) {
        let t = document.getElementById('tm-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'tm-toast';
            t.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: ${isError ? '#ff4d4f' : '#1890ff'}; color: white; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: bold; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.3s; pointer-events: none; font-family: sans-serif; max-width: 80vw; text-align: center;`;
            document.body.appendChild(t);
        }
        t.innerText = msg;
        t.style.opacity = '1';
        if (msg.indexOf('生成中') === -1 && msg.indexOf('填入') === -1 && msg.indexOf('等待') === -1 && msg.indexOf('准备') === -1) {
            setTimeout(() => { t.style.opacity = '0'; }, 3000);
        }
    }

    function disablePasteRestrictions() {
        document.onpaste = null; document.oncopy = null; document.oncut = null; document.oncontextmenu = null;
        ['paste', 'copy', 'cut', 'contextmenu', 'keydown'].forEach(evt => {
            document.addEventListener(evt, e => e.stopPropagation(), true);
        });
    }

    function isReallyVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getCourseName() {
        const sels = ['.course-name', '.header-title', '.course-title', 'h1', '.title'];
        for (let sel of sels) {
            const els = document.querySelectorAll(sel);
            for (let el of els) {
                let text = el.innerText.trim();
                if (text && text.length > 1 && text !== '讨论区' && text !== '问答' && text !== '首页') {
                    return text.replace(/讨论|问答|话题/g, '').replace(/[《》【】\[\]]/g, '').trim();
                }
            }
        }
        return '当前专业课程';
    }

    function getCurrentAnswerQuestion() {
        const contentEl = document.querySelector('.question-box .question-content p span');
        if (contentEl) {
            const text = contentEl.innerText.trim();
            if (text) return text;
        }
        const fallback = document.querySelector('.question-box .question-content');
        if (fallback) return fallback.innerText.trim();
        return '当前课程问题';
    }

    function fetchAIAnswer(question) {
        return new Promise((resolve, reject) => {
            if (!API_KEY || API_KEY.indexOf('sk-xxx') !== -1 || API_KEY.trim() === '') { reject('请先填写 API Key！'); return; }
            const prompt = `你是一名大学生，正在回答智慧树课程《${getCourseName()}》的讨论题。

问题：${question}

请给出一个高质量的回答。
要求：
1. 紧扣问题，有深度；
2. 语气像真实的大学生，不要像官方报告；
3. 字数100-200字之间；
4. 直接输出回答内容，不要包含任何前缀、引号或解释。`;
            GM_xmlhttpRequest({
                method: "POST", url: API_URL,
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY },
                data: JSON.stringify({ model: MODEL_NAME, messages: [{ role: "user", content: prompt }], temperature: 0.8, max_tokens: 2048 }),
                onload: function(res) {
                    if (res.status === 200) {
                        try { resolve(JSON.parse(res.responseText).choices[0].message.content.trim()); }
                        catch (e) { reject("解析响应失败: " + e.message); }
                    } else { console.error("AI 错误响应:", res.responseText); reject("API报错 " + res.status); }
                },
                onerror: function() { reject("网络错误"); }
            });
        });
    }

    function fetchAIQuestion(courseName) {
        return new Promise((resolve, reject) => {
            if (!API_KEY || API_KEY.indexOf('sk-xxx') !== -1 || API_KEY.trim() === '') { reject('请先填写 API Key！'); return; }
            const prompt = `你是一名正在修读《${courseName}》这门课的大学生。请针对这门课提出一个高质量的、适合课堂讨论的专业问题。
要求：
1. 紧扣学科内容；
2. 有深度；
3. 语气像大学生；
4. 字数40-80字；
5. 只返回问题本身，不要包含任何引号或前缀。`;
            GM_xmlhttpRequest({
                method: "POST", url: API_URL,
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY },
                data: JSON.stringify({ model: MODEL_NAME, messages: [{ role: "user", content: prompt }], temperature: 0.8, max_tokens: 2048 }),
                onload: function(res) {
                    if (res.status === 200) {
                        try { resolve(JSON.parse(res.responseText).choices[0].message.content.trim()); }
                        catch (e) { reject("解析响应失败: " + e.message); }
                    } else { console.error("AI 错误响应:", res.responseText); reject("API报错 " + res.status); }
                },
                onerror: function() { reject("网络错误"); }
            });
        });
    }

    function simulateTyping(element, text) {
        element.focus();
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        let i = 0;
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (i < text.length) {
                    element.value += text.charAt(i);
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    i++;
                } else {
                    clearInterval(interval);
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    element.dispatchEvent(new Event('blur', { bubbles: true }));
                    resolve();
                }
            }, 20);
        });
    }

    function extremeClick(element) {
        if (!element) return false;
        element.removeAttribute('disabled');
        element.classList.remove('is-disabled');
        element.style.pointerEvents = 'auto';
        element.style.opacity = '1';
        element.style.cursor = 'pointer';
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts = { bubbles: true, cancelable: true, view: document.defaultView, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: 1, composed: true };
        try {
            element.dispatchEvent(new PointerEvent('pointerover', opts));
            element.dispatchEvent(new PointerEvent('pointerenter', opts));
            element.dispatchEvent(new PointerEvent('pointerdown', opts));
            element.dispatchEvent(new MouseEvent('mouseover', opts));
            element.dispatchEvent(new MouseEvent('mousemove', opts));
            element.dispatchEvent(new MouseEvent('mousedown', opts));
            element.focus();
            element.dispatchEvent(new PointerEvent('pointerup', opts));
            element.dispatchEvent(new MouseEvent('mouseup', opts));
            element.dispatchEvent(new MouseEvent('click', opts));
            element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, composed: true }));
            element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, composed: true }));
            element.click();
            return true;
        } catch (e) {
            try { element.click(); } catch (e2) {}
            return true;
        }
    }

    function findPublishButton() {
        let btn = document.querySelector('.up-btn.set-btn');
        if (btn && isReallyVisible(btn)) return btn;
        const allEls = document.querySelectorAll('div, button, span, a');
        for (let el of allEls) {
            const txt = el.innerText ? el.innerText.replace(/\s/g, '') : '';
            if (txt === '立即发布' && isReallyVisible(el)) return el;
        }
        return null;
    }

    function waitForPublishSuccess(maxWaitMs) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = setInterval(() => {
                const d = document.querySelector('.questionDialog .el-dialog__wrapper');
                const isOpen = d && isReallyVisible(d);
                if (!isOpen) { clearInterval(check); console.log('✅ 弹窗关闭，发布成功！'); resolve(true); return; }
                if (Date.now() - start > maxWaitMs) { clearInterval(check); resolve(false); return; }
            }, 300);
        });
    }

    function closeCurrentTab() {
        console.log('🔒 尝试关闭当前标签页...');
        try {
            window.open('', '_self');
            window.close();
            console.log('✅ 已尝试关闭');
        } catch (e) { console.log('❌ window.open 失败:', e); }
        setTimeout(() => { try { window.top.close(); } catch (e) {} }, 500);
        setTimeout(() => {
            if (!document.hidden) {
                showToast('⚠️ 浏览器拒绝自动关闭，请手动关闭本页', true);
                updateStatus('已发布，请手动关闭');
            }
        }, 1500);
    }

    async function doAnswer() {
        if (isProcessing) return;
        isProcessing = true;
        try {
            updateStatus('【回答模式】检测问题...');
            const question = getCurrentAnswerQuestion();
            showToast('🔍 问题: ' + question.substring(0, 20) + '...');
            console.log('完整问题:', question);

            updateStatus('寻找"我来回答"按钮...');
            const answerBtn = document.querySelector('.my-answer-btn');
            if (!answerBtn) throw new Error('找不到"我来回答"按钮');

            if (isReallyVisible(answerBtn)) {
                updateStatus('点击"我来回答"...');
                extremeClick(answerBtn);
                console.log('✅ 已点击"我来回答"');
                await new Promise(r => setTimeout(r, 1000));
            }

            updateStatus('等待输入框弹出...');
            let targetInput = null;
            for (let k = 0; k < 40; k++) {
                for (let ta of document.querySelectorAll('textarea')) {
                    if (isReallyVisible(ta) && ta.value.trim() === '') { targetInput = ta; break; }
                }
                if (targetInput) break;
                await new Promise(r => setTimeout(r, 500));
            }
            if (!targetInput) throw new Error('20秒内未检测到输入框');
            console.log('✅ 找到输入框');

            updateStatus('呼叫 AI 生成答案...');
            showToast('🧠 正在生成答案...');
            const answer = await fetchAIAnswer(question);
            console.log('AI答案:', answer);

            updateStatus('正在填入答案...');
            disablePasteRestrictions();
            await simulateTyping(targetInput, answer);

            updateStatus('等待发布按钮点亮...');
            await new Promise(r => setTimeout(r, 3000));

            const publishBtn = findPublishButton();
            if (!publishBtn) throw new Error('找不到"立即发布"按钮');

            updateStatus('正在点击发布...');
            extremeClick(publishBtn);
            await new Promise(r => setTimeout(r, 300));
            extremeClick(publishBtn);

            updateStatus('等待发布成功...');
            showToast('⏳ 等待发布完成...');
            const success = await waitForPublishSuccess(MAX_WAIT_AFTER_PUBLISH);

            if (success) {
                showToast('✅ 回答发布成功！' + (AUTO_CLOSE_AFTER_ANSWER ? '准备关闭页面...' : ''));
                updateStatus('✅ 回答已发布');
                if (AUTO_CLOSE_AFTER_ANSWER) {
                    setTimeout(() => closeCurrentTab(), CLOSE_DELAY);
                }
            } else {
                showToast('⚠️ 等待超时', true);
                updateStatus('⚠️ 等待超时');
            }
        } catch (error) {
            console.error(error);
            showToast('❌ ' + error.message, true);
            updateStatus('出错: ' + error.message);
        } finally {
            isProcessing = false;
        }
    }

    async function doAsk() {
        if (isProcessing) return;
        isProcessing = true;
        try {
            updateStatus('【提问模式】检测到弹窗打开...');

            let targetInput = null;
            for (let k = 0; k < 20; k++) {
                for (let ta of document.querySelectorAll('textarea')) {
                    if (isReallyVisible(ta) && ta.value.trim() === '') { targetInput = ta; break; }
                }
                if (targetInput) break;
                await new Promise(r => setTimeout(r, 300));
            }
            if (!targetInput) { console.log('❌ 未找到输入框'); isProcessing = false; return; }
            console.log('✅ 找到输入框');

            const courseName = getCourseName();
            updateStatus('呼叫 AI 生成问题...');
            showToast('🧠 正在生成问题...');
            const questionText = await fetchAIQuestion(courseName);
            console.log('AI生成的问题:', questionText);

            updateStatus('正在填入问题...');
            disablePasteRestrictions();
            await simulateTyping(targetInput, questionText);

            await new Promise(r => setTimeout(r, 2500));

            const publishBtn = findPublishButton();
            if (!publishBtn) { showToast('❌ 找不到"立即发布"按钮', true); isProcessing = false; return; }

            updateStatus('正在点击发布...');
            extremeClick(publishBtn);
            await new Promise(r => setTimeout(r, 300));
            extremeClick(publishBtn);

            updateStatus('等待发布成功...');
            const success = await waitForPublishSuccess(MAX_WAIT_AFTER_PUBLISH);
            if (success) {
                showToast('✅ 提问发布成功！');
                updateStatus('✅ 提问已发布');
            } else {
                showToast('⚠️ 等待超时', true);
                updateStatus('⚠️ 等待超时');
            }
        } catch (error) {
            console.error(error);
            showToast('❌ ' + error.message, true);
            updateStatus('出错: ' + error.message);
        } finally {
            isProcessing = false;
        }
    }

    function watchAskDialog() {
        setInterval(() => {
            const askBtn = document.querySelector('.ask-btn');
            if (!askBtn) return;
            const dialog = document.querySelector('.questionDialog .el-dialog__wrapper');
            const isOpen = dialog && isReallyVisible(dialog);
            if (isOpen && !lastDialogState && !isProcessing) {
                console.log('🔔 检测到提问弹窗打开');
                setTimeout(() => doAsk(), 500);
            }
            lastDialogState = isOpen;
        }, 800);
    }

    window.addEventListener('load', function() {
        createControlPanel();
        showToast('✅ 讨论区助手就绪 (Agnes 3.0 Flash)', false);
        window.addEventListener('keydown', function(e) {
            if (e.altKey && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                const answerBtn = document.querySelector('.my-answer-btn');
                if (answerBtn) doAnswer();
                else showToast('⚠️ 当前不在问题详情页，无法自动回答', true);
            }
        });
        watchAskDialog();
    });

})();
