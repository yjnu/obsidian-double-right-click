/* main.js */
const { Plugin, PluginSettingTab, Setting, MarkdownView } = require('obsidian');

// 默认设置
const DEFAULT_SETTINGS = {
	enabled: true,
    // 默认双击间隔时间为 400 毫秒
    doubleClickDelay: 400
}

class DoubleRightClickPlugin extends Plugin {
	async onload() {
		// 加载设置，包括新的 doubleClickDelay
		await this.loadSettings();

		this.lastRightClickTime = 0;

		// 注册全局鼠标按下事件
		this.registerDomEvent(document, 'mousedown', (evt) => {
			// 2 代表右键
			if (evt.button === 2) {
				this.handleRightClick(evt);
			}
		});

		// 添加设置选项卡
		this.addSettingTab(new DoubleClickSettingTab(this.app, this));
	}

	handleRightClick(evt) {
		// 如果开关没开，或当前活跃的是设置面板，直接返回
		if (!this.settings.enabled || evt.target.closest('.mod-settings')) return;

		const currentTime = new Date().getTime();
		const timeDiff = currentTime - this.lastRightClickTime;
        
        // 使用用户设定的时间间隔进行判定
		const delay = this.settings.doubleClickDelay;

		// 判定为双击
		if (timeDiff < delay && timeDiff > 0) {
			const switched = this.tryToggleMode(evt);
			
			if (switched) {
				this.lastRightClickTime = 0; // 重置防止误判
			}
		} else {
			this.lastRightClickTime = currentTime;
		}
	}

	tryToggleMode(evt) {
		const activeLeaf = this.app.workspace.activeLeaf;
		if (!activeLeaf) return false;

		const view = activeLeaf.view;

		// 确保是 Markdown 视图
		if (view instanceof MarkdownView) {
			const currentMode = view.getMode();
			let targetMode = null;

			// --- 双向切换逻辑 ---
			if (currentMode === 'preview') {
				targetMode = 'source'; // 阅读 -> 编辑
			} else if (currentMode === 'source') {
				targetMode = 'preview'; // 编辑 -> 阅读
			}

			// 如果确定了目标模式，则开始执行
			if (targetMode) {
				
				// --- 1. 拦截右键菜单 (防止弹出) ---
				evt.preventDefault();
				evt.stopPropagation();

				const blockContextMenu = (e) => {
					e.preventDefault();
					e.stopPropagation();
				};
				
				window.addEventListener('contextmenu', blockContextMenu, { capture: true, once: true });
				
				// 保险措施：300ms 后移除拦截器
				setTimeout(() => {
					window.removeEventListener('contextmenu', blockContextMenu, { capture: true });
				}, 300);

				// --- 2. 执行切换 ---
				const state = activeLeaf.getViewState();
				state.state.mode = targetMode;
				activeLeaf.setViewState(state);

				// --- 3. 模拟左键点击清除焦点/残留菜单 ---
				setTimeout(() => {
					const syntheticClick = new MouseEvent('mousedown', {
						view: window,
						bubbles: true,
						cancelable: true,
						button: 0 
					});
					document.body.dispatchEvent(syntheticClick);
				}, 50); // 延迟 50ms 确保视图切换完成

				return true;
			}
		}
		return false;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// 设置页面代码
class DoubleClickSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '双击右键切换模式设置' });

        // 启用开关
		new Setting(containerEl)
			.setName('启用双击右键切换')
			.setDesc('开启后，双击鼠标右键将在“阅读模式”和“编辑模式”之间互相切换。')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				}));
                
        // 新增：双击时间间隔输入框
        new Setting(containerEl)
            .setName('双击间隔时间 (毫秒)')
            .setDesc('两次右键点击之间的时间间隔上限。默认值 400 毫秒。')
            .addText(text => text
                .setPlaceholder('输入毫秒值，如 400')
                .setValue(String(this.plugin.settings.doubleClickDelay))
                .onChange(async (value) => {
                    const numberValue = parseInt(value);
                    // 确保输入的是一个有效的、非负的数字
                    if (!isNaN(numberValue) && numberValue >= 0) {
                        this.plugin.settings.doubleClickDelay = numberValue;
                        await this.plugin.saveSettings();
                    } else if (value.trim() === '') {
                        // 如果用户清空了输入框，则恢复默认值 400，并提示
                        this.plugin.settings.doubleClickDelay = DEFAULT_SETTINGS.doubleClickDelay;
                        await this.plugin.saveSettings();
                        text.setValue(String(DEFAULT_SETTINGS.doubleClickDelay));
                    }
                }));
	}
}

module.exports = DoubleRightClickPlugin;
