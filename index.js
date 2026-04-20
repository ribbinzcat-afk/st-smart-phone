import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, getContext } from "../../../extensions.js";

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
            <label style="flex-direction: column; align-items: flex-start;">
                Home Screen Wallpaper URL (Optional):
                <input type="text" id="st_phone_wallpaper" value="${settings.wallpaper}" placeholder="Leave blank to use Avatar" style="width: 100%;">
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

    // อัปเดตปุ่มเปิดโทรศัพท์ (ให้ Render หน้าจอก่อนโชว์เสมอ)
    $(document).off('click', '#st_phone_open_btn, #st_phone_fab').on('click', '#st_phone_open_btn, #st_phone_fab', function() {
        renderHomeScreen(); // <--- เรียกใช้ฟังก์ชันนี้ก่อน
        $('#st_phone_container').fadeIn(200);
        clearNotification();
    });

        // บันทึกวอลเปเปอร์และอัปเดตหน้าจอทันที
    $(document).on('input', '#st_phone_wallpaper', function() {
        settings.wallpaper = this.value;
        saveSettingsDebounced();
        if ($('#st_phone_container').is(':visible')) {
            renderHomeScreen();
        }
    });

    // คลิกที่ไอคอนแอพต่างๆ (เตรียมไว้สำหรับ Phase 3)
    $(document).on('click', '.st-phone-app-icon', function() {
        const appName = $(this).data('app');
        console.log("คุณกำลังเปิดแอพ:", appName);
        // เดี๋ยวเราจะทำฟังก์ชันเปิดแต่ละแอพใน Phase ต่อไปค่ะ
    });

    // ปุ่ม Home (ด้านล่างจอ) ให้กลับมาหน้า Home Screen
    $(document).on('click', '.st-phone-home-btn', function() {
        renderHomeScreen();
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

// 5. ระบบลากจูง (Draggable)
function setupDraggable() {
    // ให้ปุ่มลอยลากได้ (ลบเงื่อนไขหน้าจอออก เพื่อให้ลากได้ตลอดยกเว้นใช้ระบบสัมผัสมือถือ)
    $('#st_phone_fab').draggable({
        containment: "window",
        scroll: false,
        cancel: ".st-phone-badge"
    });

    // ให้กรอบโทรศัพท์ลากได้ (จับที่ Header และ Footer)
    $('#st_phone_container').draggable({
        handle: ".st-phone-header, .st-phone-footer",
        containment: "window",
        scroll: false,
        cancel: "select, button, input, .st-phone-close, .st-phone-home-btn"
    });
}

// --- Phase 2: ฟังก์ชันสำหรับหน้าจอหลัก ---

// ดึงข้อมูลชื่อและรูป Avatar ของตัวละครปัจจุบัน (Best Practice ของ SillyTavern)
// ดึงข้อมูลชื่อและรูป Avatar ของตัวละครปัจจุบัน (อัปเดตแก้บั๊ก 404)
function getCharDetails() {
    const context = getContext();
    const name = context.name2 || "Unknown";
    let avatarSrc = '';

    // วิธีที่ 1: ดึงจากข้อมูลตัวละครโดยตรง (แม่นยำที่สุด)
    if (context.characters && context.this_chid !== undefined && context.characters[context.this_chid]) {
        avatarSrc = `/characters/${context.characters[context.this_chid].avatar}`;
    }
    // วิธีที่ 2: ดึงจากหน้าจอ UI (กรณีฉุกเฉิน)
    else {
        const domSrc = $('#avatar_url_sys').attr('src');
        if (domSrc && domSrc.trim() !== '') {
            avatarSrc = domSrc;
        } else {
            // Fallback: ถ้ารูปไม่มีจริงๆ จะใช้รูปโปรไฟล์สีเทาแบบฝังโค้ด (ไม่มีทางติด 404 แน่นอน)
            avatarSrc = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ccc"/><circle cx="50" cy="40" r="20" fill="%23fff"/><path d="M20 100 Q50 60 80 100" stroke="%23fff" stroke-width="5" fill="none"/></svg>';
        }
    }

    return { name, avatarSrc };
}

// สร้างและแสดงผลหน้าจอหลัก
function renderHomeScreen() {
    const settings = extension_settings[extensionName];
    const charDetails = getCharDetails();

    // ถ้าผู้ใช้ใส่วอลเปเปอร์ในตั้งค่า ให้ใช้รูปนั้น ถ้าไม่ใส่ ให้ใช้รูป Avatar
    const wallpaperUrl = settings.wallpaper ? settings.wallpaper : charDetails.avatarSrc;

    const homeHtml = `
        <div class="st-phone-home-wrapper" id="st_phone_home_screen">
            <div class="st-phone-wallpaper" style="background-image: url('${wallpaperUrl}');"></div>
            <div class="st-phone-wallpaper-overlay"></div>

            <div class="st-phone-home-content">
                <div class="st-phone-header-profile">
                    <img src="${charDetails.avatarSrc}" class="st-phone-profile-img" alt="Profile">
                    <div class="st-phone-profile-name">${charDetails.name}</div>
                </div>

                <div class="st-phone-app-grid">
                    <!-- แอพ Message -->
                    <div class="st-phone-app-icon" data-app="message">
                        <div class="st-phone-app-bg" style="background-color: #25D366;"><i class="fa-solid fa-comment"></i></div>
                        <div class="st-phone-app-name">Message</div>
                        <div class="st-phone-app-badge" id="badge_message"></div>
                    </div>
                    <!-- แอพ Insta -->
                    <div class="st-phone-app-icon" data-app="insta">
                        <div class="st-phone-app-bg" style="background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);"><i class="fa-brands fa-instagram"></i></div>
                        <div class="st-phone-app-name">Insta</div>
                        <div class="st-phone-app-badge" id="badge_insta"></div>
                    </div>
                    <!-- แอพ Twitter -->
                    <div class="st-phone-app-icon" data-app="twitter">
                        <div class="st-phone-app-bg" style="background-color: #1DA1F2;"><i class="fa-brands fa-twitter"></i></div>
                        <div class="st-phone-app-name">Twitter</div>
                        <div class="st-phone-app-badge" id="badge_twitter"></div>
                    </div>
                    <!-- แอพ Settings -->
                    <div class="st-phone-app-icon" data-app="settings">
                        <div class="st-phone-app-bg" style="background-color: #8E8E93;"><i class="fa-solid fa-gear"></i></div>
                        <div class="st-phone-app-name">Settings</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    $('#st_phone_screen').html(homeHtml);
}

// --- Phase 3.1: Message App (ระบบแชทพื้นฐาน) ---
let messageDrafts = []; // อาร์เรย์เก็บข้อความที่เตรียมจะส่ง

// ฟังก์ชันสร้างหน้าจอแชท
function renderMessageApp() {
    const charDetails = getCharDetails();
    const settings = extension_settings[extensionName];
    const wallpaperUrl = settings.wallpaper ? settings.wallpaper : charDetails.avatarSrc;

    const html = `
        <div class="st-phone-home-wrapper">
            <!-- วอลเปเปอร์เหมือนหน้าจอหลัก -->
            <div class="st-phone-wallpaper" style="background-image: url('${wallpaperUrl}');"></div>
            <div class="st-phone-wallpaper-overlay"></div>

            <!-- Header แชท -->
            <div class="st-phone-app-header">
                <div class="st-phone-back-btn" title="Back"><i class="fa-solid fa-chevron-left"></i></div>
                <div class="st-phone-app-title">${charDetails.name}</div>
            </div>

            <!-- พื้นที่แสดงบับเบิลแชท -->
            <div class="st-phone-chat-area" id="st_phone_chat_history"></div>

            <!-- แถบพิมพ์ข้อความ -->
            <div class="st-phone-input-area">
                <div class="st-phone-input-row">
                    <div class="st-phone-icon-btn" id="st_phone_plus_btn" title="Add Element"><i class="fa-solid fa-plus"></i></div>
                    <div class="st-phone-icon-btn" id="st_phone_sticker_btn" title="Sticker"><i class="fa-regular fa-face-smile"></i></div>
                    <div class="st-phone-icon-btn" id="st_phone_image_btn" title="Image"><i class="fa-regular fa-image"></i></div>

                    <input type="text" class="st-phone-text-input" id="st_phone_msg_input" placeholder="Type a message...">

                    <div class="st-phone-send-btn" id="st_phone_add_draft" title="Add to Draft"><i class="fa-solid fa-paper-plane"></i></div>
                </div>
                <div class="st-phone-export-btn" id="st_phone_export_prompt">Send to Chat Input</div>
            </div>
        </div>
    `;
    $('#st_phone_screen').html(html);
    updateChatDraftsUI(); // อัปเดตบับเบิลแชททันที
}

// ฟังก์ชันอัปเดตบับเบิลแชทบนหน้าจอ
function updateChatDraftsUI() {
    const chatArea = $('#st_phone_chat_history');
    chatArea.empty();

    if (messageDrafts.length === 0) {
        chatArea.append(`<div style="color: rgba(255,255,255,0.6); text-align: center; margin-top: 20px; font-family: sans-serif; font-size: 13px;">No drafted messages.<br>Type below to start.</div>`);
        return;
    }

    messageDrafts.forEach((draft, index) => {
        let contentHtml = '';
        if (draft.type === 'text') {
            contentHtml = draft.text; // ตอนนี้มีแค่ text เดี๋ยว Phase หน้าจะมี sticker, slip
        }

        const bubbleHtml = `
            <div class="st-phone-bubble-wrapper">
                <div class="st-phone-bubble">${contentHtml}</div>
                <div class="st-phone-bubble-delete" data-index="${index}"><i class="fa-solid fa-trash"></i> Delete</div>
            </div>
        `;
        chatArea.append(bubbleHtml);
    });

    // เลื่อนหน้าจอลงล่างสุดเสมอเมื่อมีข้อความใหม่
    chatArea.scrollTop(chatArea[0].scrollHeight);
}

// เริ่มต้นการทำงานเมื่อโหลดสคริปต์
jQuery(async () => {
    await initUI();
});
