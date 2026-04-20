import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from "../../../extensions.js";

const extensionName = "st-smart-phone";

// 1. กำหนดค่า Default Settings (Deep Copy ป้องกันบั๊ก)
const defaultSettings = {
    isFabEnabled: true,
    phoneColor: "#ffffff",
    iconColor: "#000000",
    wallpaper: "",
    mediaLibrary: {
        stickers: [],
        images: []
    }
};

async function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = JSON.parse(JSON.stringify(defaultSettings));
    }
    // อัปเดตค่าที่อาจจะขาดหายไป
    for (const key in defaultSettings) {
        if (!(key in extension_settings[extensionName])) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
}

// 2. สร้าง UI ทั้งหมด
async function initUI() {
    await loadSettings();
    const settings = extension_settings[extensionName];

    // --- Inject Settings Panel ---
    const settingsHtml = `
        <div class="st-phone-settings-block">
            <h4>📱 Smart Phone Settings</h4>
            <label>
                <input type="checkbox" id="st_phone_enable_fab" ${settings.isFabEnabled ? 'checked' : ''}>
                Enable Floating Button
            </label>
            <label>
                Phone Frame Color:
                <input type="color" id="st_phone_color" value="${settings.phoneColor}">
            </label>
            <label>
                Icon Color:
                <input type="color" id="st_phone_icon_color" value="${settings.iconColor}">
            </label>
            <hr>
            <div class="menu_button" id="st_phone_open_btn">Open Phone</div>
            <div class="menu_button" id="st_phone_test_noti">Test Notification</div>
        </div>
    `;
    const settingsContainer = document.getElementById('extensions_settings');
    if (settingsContainer) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = settingsHtml;
        settingsContainer.appendChild(wrapper);
    }

    // --- Inject Floating Button (FAB) ---
    const fabHtml = `
        <div id="st_phone_fab" class="st-phone-fab" style="display: ${settings.isFabEnabled ? 'flex' : 'none'}; color: ${settings.iconColor};">
            <i class="fa-solid fa-mobile-screen"></i>
            <div class="st-phone-badge"></div>
        </div>
    `;
    $('body').append(fabHtml);

    // --- Inject Phone Container ---
    const phoneHtml = `
        <div id="st_phone_container" class="st-phone-container" style="border-color: ${settings.phoneColor};">
            <div class="st-phone-header">
                <div class="st-phone-speaker"></div>
                <div class="st-phone-close" title="Close"><i class="fa-solid fa-xmark"></i></div>
            </div>
            <div class="st-phone-screen" id="st_phone_screen">
                <!-- เนื้อหาหน้าจอหลักจะมาใส่ตรงนี้ใน Phase ต่อไป -->
                <div style="display: flex; height: 100%; justify-content: center; align-items: center; color: #aaa; font-family: sans-serif;">
                    Home Screen (Coming Soon)
                </div>
            </div>
            <div class="st-phone-footer">
                <div class="st-phone-home-btn" title="Home"></div>
            </div>
        </div>
    `;
    $('body').append(phoneHtml);

    setupEvents();
    setupDraggable();
}

// 3. จัดการ Events (ใช้ jQuery Event Delegation)
function setupEvents() {
    const settings = extension_settings[extensionName];

    // เปิด-ปิด ปุ่มลอย
    $(document).on('change', '#st_phone_enable_fab', function() {
        settings.isFabEnabled = this.checked;
        $('#st_phone_fab').css('display', this.checked ? 'flex' : 'none');
        saveSettingsDebounced();
    });

    // เปลี่ยนสีกรอบโทรศัพท์
    $(document).on('input', '#st_phone_color', function() {
        settings.phoneColor = this.value;
        $('#st_phone_container').css('border-color', this.value);
    });
    $(document).on('change', '#st_phone_color', saveSettingsDebounced);

    // เปลี่ยนสีไอคอนปุ่มลอย
    $(document).on('input', '#st_phone_icon_color', function() {
        settings.iconColor = this.value;
        $('#st_phone_fab').css('color', this.value);
    });
    $(document).on('change', '#st_phone_icon_color', saveSettingsDebounced);

    // ปุ่มเปิดโทรศัพท์ (จากเมนู และ จากปุ่มลอย)
    $(document).on('click', '#st_phone_open_btn, #st_phone_fab', function() {
        $('#st_phone_container').fadeIn(200);
        clearNotification(); // เปิดจอแล้วให้ลบแจ้งเตือน
    });

    // ปุ่มปิดโทรศัพท์
    $(document).on('click', '.st-phone-close, .st-phone-home-btn', function() {
        $('#st_phone_container').fadeOut(200);
    });

    // ปุ่มทดสอบแจ้งเตือน
    $(document).on('click', '#st_phone_test_noti', triggerNotification);
}

// 4. ฟังก์ชันจัดการแจ้งเตือน
function triggerNotification() {
    const fab = $('#st_phone_fab');
    fab.addClass('active-notification st-phone-shake');
    fab.find('.st-phone-badge').show();

    // หยุดสั่นหลังผ่านไป 2 วินาที แต่ยังคงจุดแดงไว้
    setTimeout(() => {
        fab.removeClass('st-phone-shake');
    }, 2000);
}

function clearNotification() {
    const fab = $('#st_phone_fab');
    fab.removeClass('active-notification st-phone-shake');
    fab.find('.st-phone-badge').hide();
}

// 5. ระบบลากจูง (Draggable) รองรับการใช้งานมือถือ
function setupDraggable() {
    if (window.innerWidth > 768) {
        // ให้ปุ่มลอยลากได้
        $('#st_phone_fab').draggable({
            containment: "window",
            cancel: ".st-phone-badge"
        });

        // ให้กรอบโทรศัพท์ลากได้ (จับที่ Header และ Footer)
        $('#st_phone_container').draggable({
            handle: ".st-phone-header, .st-phone-footer",
            containment: "window",
            cancel: "select, button, input, .st-phone-close, .st-phone-home-btn"
        });
    }
}

// เริ่มต้นการทำงานเมื่อโหลดสคริปต์
jQuery(async () => {
    await initUI();
});
