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

        // --- Events สำหรับ Message App ---

    // 1. คลิกไอคอน Message เพื่อเปิดแอพแชท
    $(document).off('click', '.st-phone-app-icon[data-app="message"]').on('click', '.st-phone-app-icon[data-app="message"]', function() {
        renderMessageApp();
    });

    // 2. ปุ่ม Back (กลับหน้า Home)
    $(document).on('click', '.st-phone-back-btn', function() {
        renderHomeScreen();
    });

    // 3. พิมพ์ข้อความแล้วกดปุ่ม "ส่ง (จรวด)" เพื่อนำเข้า Draft
    $(document).on('click', '#st_phone_add_draft', function() {
        const input = $('#st_phone_msg_input');
        const text = input.val().trim();
        if (text) {
            messageDrafts.push({ type: 'text', text: text });
            input.val(''); // ล้างช่องพิมพ์
            updateChatDraftsUI();
        }
    });

    // 4. กด Enter ในช่องพิมพ์ เพื่อส่งข้อความเข้า Draft
    $(document).on('keypress', '#st_phone_msg_input', function(e) {
        if (e.which === 13) {
            $('#st_phone_add_draft').click();
        }
    });

    // 5. ปุ่มลบข้อความ (ถ้าร่างผิด)
    $(document).on('click', '.st-phone-bubble-delete', function() {
        const index = $(this).data('index');
        messageDrafts.splice(index, 1); // ลบออกจากอาร์เรย์
        updateChatDraftsUI();
    });

    // 6. ปุ่ม "Send to Chat Input" (อัปเดตรองรับ Sticker/Image)
    $(document).off('click', '#st_phone_export_prompt').on('click', '#st_phone_export_prompt', function() {
        if (messageDrafts.length === 0) return;

        let promptText = `\n[📱 Message to Assistant]:\n`;
        messageDrafts.forEach(draft => {
            if (draft.type === 'text') {
                promptText += `You: ${draft.text}\n`;
            } else if (draft.type === 'slip') {
                promptText += `[💸 You sent a Transfer Slip: Amount ${draft.amount} to ${draft.to}]\n`;
            } else if (draft.type === 'loc') {
                promptText += `[📍 You shared a Location: ${draft.place}]\n`;
            } else if (draft.type === 'voice') {
                promptText += `[🎤 You sent a Voice Message: "${draft.text}"]\n`;
            } else if (draft.type === 'sticker') {
                promptText += `[✨ You sent a Sticker: "${draft.name}"]\n`;
            } else if (draft.type === 'image') {
                promptText += `[🖼️ You sent an Image: "${draft.name}"]\n`;
            }
        });

        const stInput = $('#send_textarea');
        const currentVal = stInput.val();
        stInput.val(currentVal + promptText).trigger('input');

        messageDrafts = [];
        updateChatDraftsUI();
        $('#st_phone_container').fadeOut(200);
    });
    
    // --- Events สำหรับเมนู + และ Modal ---
    let currentModalType = '';

    // เปิด/ปิด เมนู +
    $(document).on('click', '#st_phone_plus_btn', function() {
        $('#st_phone_plus_menu').fadeToggle(100);
    });

    // ปิดเมนู + เมื่อคลิกที่อื่น
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#st_phone_plus_btn, #st_phone_plus_menu').length) {
            $('#st_phone_plus_menu').fadeOut(100);
        }
    });

    // คลิกเลือกเมนูใน +
    $(document).on('click', '.st-phone-plus-item', function() {
        currentModalType = $(this).data('type');
        $('#st_phone_plus_menu').fadeOut(100);

        const modalTitle = $('#st_phone_modal_title');
        const modalBody = $('#st_phone_modal_body');

        if (currentModalType === 'slip') {
            modalTitle.text('Create Transfer Slip');
            modalBody.html(`
                <input type="text" id="modal_slip_amount" class="st-phone-modal-input" placeholder="Amount (e.g. 1000 Credits)">
                <input type="text" id="modal_slip_to" class="st-phone-modal-input" placeholder="Transfer To (Name)" style="margin-top:10px;">
            `);
        } else if (currentModalType === 'loc') {
            modalTitle.text('Share Location');
            modalBody.html(`
                <input type="text" id="modal_loc_place" class="st-phone-modal-input" placeholder="Location Name / Address">
            `);
        } else if (currentModalType === 'voice') {
            modalTitle.text('Record Voice Message');
            modalBody.html(`
                <input type="text" id="modal_voice_text" class="st-phone-modal-input" placeholder="Type what the character says...">
            `);
        }
        $('#st_phone_modal').fadeIn(200);
    });

    // ปิด Modal
    $(document).on('click', '#st_phone_modal_cancel', function() {
        $('#st_phone_modal').fadeOut(200);
    });

    // ยืนยันข้อมูลใน Modal และเพิ่มลง Draft (อัปเดตเพิ่ม add_media)
    $(document).off('click', '#st_phone_modal_confirm').on('click', '#st_phone_modal_confirm', function() {
        if (currentModalType === 'slip') {
            const amount = $('#modal_slip_amount').val().trim() || '0';
            const to = $('#modal_slip_to').val().trim() || 'Unknown';
            messageDrafts.push({ type: 'slip', amount: amount, to: to });
        } else if (currentModalType === 'loc') {
            const place = $('#modal_loc_place').val().trim() || 'Unknown Location';
            messageDrafts.push({ type: 'loc', place: place });
        } else if (currentModalType === 'voice') {
            const text = $('#modal_voice_text').val().trim() || '...';
            messageDrafts.push({ type: 'voice', text: text });
        }
        // --- เพิ่มโค้ดส่วนนี้เข้าไป ---
        else if (currentModalType === 'add_media') {
            const name = $('#modal_media_name').val().trim() || 'Untitled';
            const url = $('#modal_media_url').val().trim();
            if (url) {
                const settings = extension_settings[extensionName];
                if (!settings.mediaLibrary) settings.mediaLibrary = { stickers: [], images: [] };
                settings.mediaLibrary[currentPickerType].push({ name, url });
                saveSettingsDebounced(); // บันทึกรูปลงระบบ
                renderMediaGrid(); // รีเฟรชคลัง
            }
        }

        if (currentModalType !== 'add_media') {
            updateChatDraftsUI();
        }
        $('#st_phone_modal').fadeOut(200);
    });

        // --- Events สำหรับ Sticker & Image Library ---
    let currentPickerType = ''; // เก็บค่าว่าเป็น 'stickers' หรือ 'images'

    // ฟังก์ชันวาด Grid รูปภาพ
    function renderMediaGrid() {
        const settings = extension_settings[extensionName];
        const grid = $('#st_phone_picker_grid');
        grid.empty();

        // ถ้าไม่มีข้อมูล ให้สร้าง Array เปล่ารอไว้
        if (!settings.mediaLibrary) settings.mediaLibrary = { stickers: [], images: [] };
        const items = settings.mediaLibrary[currentPickerType] || [];

        if (items.length === 0) {
            grid.html(`<div style="grid-column: 1 / -1; text-align: center; color: #999; font-family: sans-serif; font-size: 13px; margin-top: 20px;">No ${currentPickerType} found.<br>Click 'Add New' to upload via URL.</div>`);
            return;
        }

        items.forEach((item, index) => {
            grid.append(`
                <div class="st-phone-media-item">
                    <img src="${item.url}" alt="${item.name}" data-index="${index}" class="st-phone-select-media">
                    <span>${item.name}</span>
                    <div class="st-phone-media-delete" data-index="${index}" title="Delete"><i class="fa-solid fa-xmark"></i></div>
                </div>
            `);
        });
    }

    // เปิดคลังสติกเกอร์
    $(document).on('click', '#st_phone_sticker_btn', function() {
        currentPickerType = 'stickers';
        $('#st_phone_picker_title').text('Stickers');
        renderMediaGrid();
        $('#st_phone_media_picker').slideDown(200);
    });

    // เปิดคลังรูปภาพ
    $(document).on('click', '#st_phone_image_btn', function() {
        currentPickerType = 'images';
        $('#st_phone_picker_title').text('Images');
        renderMediaGrid();
        $('#st_phone_media_picker').slideDown(200);
    });

    // ปิดคลัง
    $(document).on('click', '#st_phone_picker_close', function() {
        $('#st_phone_media_picker').slideUp(200);
    });

    // ปุ่ม "Add New" ในคลัง (ใช้ Modal ตัวเดิมที่มีอยู่แล้ว)
    $(document).on('click', '#st_phone_picker_add', function() {
        currentModalType = 'add_media';
        $('#st_phone_modal_title').text(`Add New ${currentPickerType === 'stickers' ? 'Sticker' : 'Image'}`);
        $('#st_phone_modal_body').html(`
            <input type="text" id="modal_media_name" class="st-phone-modal-input" placeholder="Name (e.g. Happy Cat)">
            <input type="text" id="modal_media_url" class="st-phone-modal-input" placeholder="Image URL (https://...)" style="margin-top:10px;">
        `);
        $('#st_phone_modal').fadeIn(200);
    });

    // เลือกรูป/สติกเกอร์เพื่อส่งเข้า Draft
    $(document).on('click', '.st-phone-select-media', function() {
        const index = $(this).data('index');
        const settings = extension_settings[extensionName];
        const item = settings.mediaLibrary[currentPickerType][index];

        messageDrafts.push({
            type: currentPickerType === 'stickers' ? 'sticker' : 'image',
            name: item.name,
            url: item.url
        });

        updateChatDraftsUI();
        $('#st_phone_media_picker').slideUp(200); // ส่งแล้วปิดคลังให้อัตโนมัติ
    });

    // ลบรูปออกจากคลัง
    $(document).on('click', '.st-phone-media-delete', function(e) {
        e.stopPropagation(); // กันไม่ให้เผลอกดส่งรูปตอนกดลบ
        const index = $(this).data('index');
        const settings = extension_settings[extensionName];

        if (confirm('Delete this item from library?')) {
            settings.mediaLibrary[currentPickerType].splice(index, 1);
            saveSettingsDebounced(); // บันทึกการลบลงระบบ
            renderMediaGrid(); // รีเฟรชคลัง
        }
    });

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
function getCharDetails() {
    const context = getContext();
    const name = context.name2 || "Unknown";
    let avatarSrc = '';

    if (context.characters && context.this_chid !== undefined && context.characters[context.this_chid]) {
        avatarSrc = `/characters/${context.characters[context.this_chid].avatar}`;
    } else {
        const domSrc = $('#avatar_url_sys').attr('src');
        if (domSrc && domSrc.trim() !== '') {
            avatarSrc = domSrc;
        } else {
            // เปลี่ยนฟันหนูคู่ (") เป็นฟันหนูเดี่ยว (') ทั้งหมด เพื่อไม่ให้โค้ด HTML แตก
            avatarSrc = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23ccc'/><circle cx='50' cy='40' r='20' fill='%23fff'/><path d='M20 100 Q50 60 80 100' stroke='%23fff' stroke-width='5' fill='none'/></svg>";
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

// ฟังก์ชันสร้างหน้าจอแชท (อัปเดตเพิ่ม Modal และ Menu)
function renderMessageApp() {
    const charDetails = getCharDetails();
    const settings = extension_settings[extensionName];
    const wallpaperUrl = settings.wallpaper ? settings.wallpaper : charDetails.avatarSrc;

    const html = `
        <div class="st-phone-home-wrapper">
            <div class="st-phone-wallpaper" style="background-image: url('${wallpaperUrl}');"></div>
            <div class="st-phone-wallpaper-overlay"></div>

            <div class="st-phone-app-header">
                <div class="st-phone-back-btn" title="Back"><i class="fa-solid fa-chevron-left"></i></div>
                <div class="st-phone-app-title">${charDetails.name}</div>
            </div>

            <div class="st-phone-chat-area" id="st_phone_chat_history"></div>

            <div class="st-phone-input-area">
                <!-- เมนู + -->
                <div class="st-phone-plus-menu" id="st_phone_plus_menu">
                    <div class="st-phone-plus-item" data-type="slip"><i class="fa-solid fa-money-bill-transfer"></i> Transfer Slip</div>
                    <div class="st-phone-plus-item" data-type="loc"><i class="fa-solid fa-location-dot"></i> Location</div>
                    <div class="st-phone-plus-item" data-type="voice"><i class="fa-solid fa-microphone"></i> Voice Message</div>
                </div>

                <div class="st-phone-input-row">
                    <div class="st-phone-icon-btn" id="st_phone_plus_btn" title="Add Element"><i class="fa-solid fa-plus"></i></div>
                    <div class="st-phone-icon-btn" id="st_phone_sticker_btn" title="Sticker"><i class="fa-regular fa-face-smile"></i></div>
                    <div class="st-phone-icon-btn" id="st_phone_image_btn" title="Image"><i class="fa-regular fa-image"></i></div>
                    <input type="text" class="st-phone-text-input" id="st_phone_msg_input" placeholder="Type a message...">
                    <div class="st-phone-send-btn" id="st_phone_add_draft" title="Add to Draft"><i class="fa-solid fa-paper-plane"></i></div>
                </div>
                <div class="st-phone-export-btn" id="st_phone_export_prompt">Send to Chat Input</div>
            
            <!-- หน้าต่างคลังมีเดีย (Sticker / Image Picker) -->
            <div class="st-phone-media-picker" id="st_phone_media_picker">
                <div class="st-phone-picker-header">
                    <div class="st-phone-picker-close" id="st_phone_picker_close">Close</div>
                    <div id="st_phone_picker_title">Select</div>
                    <div class="st-phone-picker-add" id="st_phone_picker_add"><i class="fa-solid fa-plus"></i> Add New</div>
                </div>
                <div class="st-phone-picker-grid" id="st_phone_picker_grid"></div>
            </div>

            </div>

            <!-- หน้าต่าง Modal สำหรับกรอกข้อมูล -->
            <div class="st-phone-modal-overlay" id="st_phone_modal">
                <div class="st-phone-modal-content">
                    <div class="st-phone-modal-title" id="st_phone_modal_title">Title</div>
                    <div id="st_phone_modal_body"></div>
                    <div class="st-phone-modal-btns">
                        <button class="st-phone-btn st-phone-btn-cancel" id="st_phone_modal_cancel">Cancel</button>
                        <button class="st-phone-btn st-phone-btn-confirm" id="st_phone_modal_confirm">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    $('#st_phone_screen').html(html);
    updateChatDraftsUI();
}

// ฟังก์ชันอัปเดตบับเบิลแชท (อัปเดตรองรับ Slip, Loc, Voice)
function updateChatDraftsUI() {
    const chatArea = $('#st_phone_chat_history');
    chatArea.empty();

    if (messageDrafts.length === 0) {
        chatArea.append(`<div style="color: rgba(255,255,255,0.6); text-align: center; margin-top: 20px; font-family: sans-serif; font-size: 13px;">No drafted messages.</div>`);
        return;
    }

    messageDrafts.forEach((draft, index) => {
        let contentHtml = '';

        if (draft.type === 'text') {
            contentHtml = `<div class="st-phone-bubble">${draft.text}</div>`;
        }
        else if (draft.type === 'slip') {
            contentHtml = `
                <div class="st-phone-bubble-slip">
                    <div style="font-size: 24px; margin-bottom: 5px;"><i class="fa-solid fa-circle-check"></i></div>
                    <div style="font-weight: bold;">Transfer Successful</div>
                    <div style="font-size: 13px; opacity: 0.9;">Amount: ${draft.amount}</div>
                    <div style="font-size: 13px; opacity: 0.9;">To: ${draft.to}</div>
                </div>`;
        }
        else if (draft.type === 'loc') {
            contentHtml = `
                <div class="st-phone-bubble-loc">
                    <div style="font-size: 24px; margin-bottom: 5px;"><i class="fa-solid fa-map-location-dot"></i></div>
                    <div style="font-weight: bold;">Location Shared</div>
                    <div style="font-size: 13px; opacity: 0.9;">${draft.place}</div>
                </div>`;
        }
        else if (draft.type === 'voice') {
            contentHtml = `
                <div class="st-phone-bubble-voice">
                    <div class="st-phone-voice-play" onclick="$(this).next('.st-phone-voice-text').slideToggle();">
                        <i class="fa-solid fa-circle-play"></i> Voice Message
                    </div>
                    <div class="st-phone-voice-text">"${draft.text}"</div>
                </div>`;
        }
        else if (draft.type === 'sticker' || draft.type === 'image') {
            contentHtml = `
                <div class="st-phone-bubble-media">
                    <img src="${draft.url}" alt="${draft.name}">
                </div>`;
        }

        const bubbleHtml = `
            <div class="st-phone-bubble-wrapper">
                ${contentHtml}
                <div class="st-phone-bubble-delete" data-index="${index}"><i class="fa-solid fa-trash"></i> Delete</div>
            </div>
        `;
        chatArea.append(bubbleHtml);
    });

    chatArea.scrollTop(chatArea[0].scrollHeight);
}

// เริ่มต้นการทำงานเมื่อโหลดสคริปต์
jQuery(async () => {
    await initUI();
});
