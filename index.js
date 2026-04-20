import { saveSettingsDebounced, setExtensionPrompt, eventSource, event_types } from '../../../../script.js';
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

    updateSystemPrompt(); // <--- เพิ่มบรรทัดนี้
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

    // เคลียร์จุดแดงเมื่อกดเข้าแอพ (อัปเดตให้ลบความจำด้วย)
    $(document).on('click', '.st-phone-app-icon[data-app="message"]', function() {
        appNotifications.message = false;
        $('#badge_message').hide();
    });
    $(document).on('click', '.st-phone-app-icon[data-app="insta"]', function() {
        appNotifications.insta = false;
        $('#badge_insta').hide();
    });
    $(document).on('click', '.st-phone-app-icon[data-app="twitter"]', function() {
        appNotifications.twitter = false;
        $('#badge_twitter').hide();
    });

    // อัปเดต Prompt ทุกครั้งที่มีการเพิ่ม/ลบ สติกเกอร์หรือรูปภาพ
    $(document).on('click', '#st_phone_modal_confirm, .st-phone-media-delete', function() {
        if (currentModalType === 'add_media' || $(this).hasClass('st-phone-media-delete')) {
            setTimeout(updateSystemPrompt, 500);
        }
    });

    // ดักจับข้อความใหม่จาก AI
    eventSource.on(event_types.MESSAGE_RECEIVED, handleIncomingMessage);

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

        let promptText = `\n[📱 Message to ${charDetails.name}]:\n`;
        messageDrafts.forEach(draft => {
            if (draft.type === 'text') {
                promptText += `${userDetails.name}: ${draft.text}\n`;
            } else if (draft.type === 'slip') {
                promptText += `[💸 ${userDetails.name} sent a Transfer Slip: Amount ${draft.amount} to ${draft.to}]\n`;
            } else if (draft.type === 'loc') {
                promptText += `[📍 ${userDetails.name} shared a Location: ${draft.place}]\n`;
            } else if (draft.type === 'voice') {
                promptText += `[🎤 ${userDetails.name} sent a Voice Message: "${draft.text}"]\n`;
            } else if (draft.type === 'sticker') {
                promptText += `[✨ ${userDetails.name} sent a Sticker: "${draft.name}"]\n`;
            } else if (draft.type === 'image') {
                promptText += `[🖼️ ${userDetails.name} sent an Image: "${draft.name}"]\n`;
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

        else if (currentModalType === 'insta_post') {
            const imgUrl = $('#modal_insta_img').val().trim() || 'https://via.placeholder.com/400';
            const imageDesc = $('#modal_insta_desc').val().trim() || 'A photo uploaded by user'; // เก็บคำอธิบายรูป
            const caption = $('#modal_insta_caption').val().trim() || '';
            const likes = $('#modal_insta_likes').val().trim() || '0';
            const comments = $('#modal_insta_comments').val().trim() || '0';

            instaDrafts.push({ imgUrl, imageDesc, caption, likes, comments });
            updateInstaDraftsUI();
            $('#st_phone_modal').fadeOut(200);
            return;
        }

        else if (currentModalType === 'tw_post') {
            const displayName = $('#modal_tw_display').val().trim() || 'User';
            const username = $('#modal_tw_user').val().trim() || 'user';
            const text = $('#modal_tw_text').val().trim() || '';
            const isPrivate = $('#modal_tw_private').is(':checked');
            const replies = $('#modal_tw_replies').val().trim() || '0';
            const retweets = $('#modal_tw_rts').val().trim() || '0';
            const likes = $('#modal_tw_likes').val().trim() || '0';

            if(text) {
                twitterDrafts.push({ displayName, username, text, isPrivate, replies, retweets, likes });
                updateTwitterDraftsUI();
            }
            $('#st_phone_modal').fadeOut(200);
            return; // หยุดการทำงานตรงนี้สำหรับ Twitter
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

    // --- Events สำหรับ Insta App ---

    // 1. คลิกไอคอน Insta เพื่อเปิดแอพ
    $(document).off('click', '.st-phone-app-icon[data-app="insta"]').on('click', '.st-phone-app-icon[data-app="insta"]', function() {
        renderInstaApp();
    });

    // 2. คลิกปุ่ม (+) เพื่อสร้างโพสต์ (ใช้ Modal ตัวเดิม)
    $(document).on('click', '#st_phone_insta_add', function() {
        currentModalType = 'insta_post';
        $('#st_phone_modal_title').text('Create Insta Post');
        $('#st_phone_modal_body').html(`
            <input type="text" id="modal_insta_img" class="st-phone-modal-input" placeholder="Image URL (https://...)">
            <input type="text" id="modal_insta_desc" class="st-phone-modal-input" placeholder="Image Description (For AI to understand)" style="margin-top:10px; border-color:#FF9500;">
            <input type="text" id="modal_insta_caption" class="st-phone-modal-input" placeholder="Write a caption..." style="margin-top:10px;">
            <div style="display:flex; gap:10px; margin-top:10px;">
                <input type="number" id="modal_insta_likes" class="st-phone-modal-input" placeholder="Likes (e.g. 1200)">
                <input type="number" id="modal_insta_comments" class="st-phone-modal-input" placeholder="Comments (e.g. 45)">
            </div>
        `);
        $('#st_phone_modal').fadeIn(200);
    });

    // 3. ปุ่ม Delete โพสต์
    $(document).on('click', '.st-phone-insta-post-delete', function() {
        const index = $(this).data('index');
        instaDrafts.splice(index, 1);
        updateInstaDraftsUI();
    });

    // 4. ปุ่มส่งออก Prompt ของ Insta
    $(document).on('click', '#st_phone_insta_export', function() {
        if (instaDrafts.length === 0) return;

        let promptText = `\n[📸 Insta App - New Post by ${userDetails.name}]:\n`;
        instaDrafts.forEach(draft => {
            promptText += `- Image: [${draft.imgUrl}]\n`;
            promptText += `- [Image Description for AI: ${draft.imageDesc}]\n`; // เพิ่มบรรทัดนี้
            promptText += `- Caption: "${draft.caption}"\n`;
            promptText += `- Stats: ${draft.likes} Likes | ${draft.comments} Comments\n\n`;
        });

        const stInput = $('#send_textarea');
        const currentVal = stInput.val();
        stInput.val(currentVal + promptText).trigger('input');

        instaDrafts = []; // ล้าง Draft
        updateInstaDraftsUI();
        $('#st_phone_container').fadeOut(200);
    });

        // --- Events สำหรับ Twitter App ---

    // 1. คลิกไอคอน Twitter เพื่อเปิดแอพ
    $(document).off('click', '.st-phone-app-icon[data-app="twitter"]').on('click', '.st-phone-app-icon[data-app="twitter"]', function() {
        renderTwitterApp();
    });

    // 2. สลับธีม (Light/Dark)
    $(document).on('click', '#st_phone_tw_theme', function() {
        const settings = extension_settings[extensionName];
        settings.twitterTheme = settings.twitterTheme === 'dark' ? 'light' : 'dark';
        saveSettingsDebounced();
        renderTwitterApp(); // รีเฟรชหน้าจอเพื่อเปลี่ยนสี
    });

    // 3. คลิกปุ่ม (ขนนก) เพื่อสร้างทวีต
    $(document).on('click', '#st_phone_tw_add', function() {
        currentModalType = 'tw_post';
        $('#st_phone_modal_title').text('Compose Tweet');

        const charDetails = getCharDetails();
        // สร้าง Username อัตโนมัติจากชื่อตัวละคร (ลบช่องว่างและทำเป็นตัวเล็ก)
        const defaultUsername = charDetails.name.replace(/\s+/g, '').toLowerCase();

        $('#st_phone_modal_body').html(`
            <input type="text" id="modal_tw_display" class="st-phone-modal-input" value="You" placeholder="Display Name">
            <input type="text" id="modal_tw_user" class="st-phone-modal-input" value="${defaultUsername}" placeholder="Username (without @)" style="margin-top:10px;">
            <textarea id="modal_tw_text" class="st-phone-modal-input" placeholder="What's happening?" style="margin-top:10px; height:80px; resize:none; font-family:sans-serif;"></textarea>

            <label style="display:flex; align-items:center; gap:10px; margin-top:10px; font-size:14px; cursor:pointer;">
                <input type="checkbox" id="modal_tw_private"> Private Account
            </label>

            <div style="display:flex; gap:10px; margin-top:10px;">
                <input type="number" id="modal_tw_replies" class="st-phone-modal-input" placeholder="Replies">
                <input type="number" id="modal_tw_rts" class="st-phone-modal-input" placeholder="Retweets">
                <input type="number" id="modal_tw_likes" class="st-phone-modal-input" placeholder="Likes">
            </div>
        `);
        $('#st_phone_modal').fadeIn(200);
    });

    // 4. ปุ่ม Delete ทวีต
    $(document).on('click', '.st-phone-tw-delete', function() {
        const index = $(this).data('index');
        twitterDrafts.splice(index, 1);
        updateTwitterDraftsUI();
    });

    // 5. ปุ่มส่งออก Prompt ของ Twitter
    $(document).on('click', '#st_phone_tw_export', function() {
        if (twitterDrafts.length === 0) return;

        let promptText = `\n[🐦 Twitter App - New Tweet]:\n`;
        twitterDrafts.forEach(draft => {
            const privacy = draft.isPrivate ? "(Private Account)" : "(Public Account)";
            promptText += `Name: ${draft.displayName} (@${draft.username}) ${privacy}\n`;
            promptText += `Tweet: "${draft.text}"\n`;
            promptText += `Stats: ${draft.replies} Replies | ${draft.retweets} Retweets | ${draft.likes} Likes\n\n`;
        });

        const stInput = $('#send_textarea');
        const currentVal = stInput.val();
        stInput.val(currentVal + promptText).trigger('input');

        twitterDrafts = []; // ล้าง Draft
        updateTwitterDraftsUI();
        $('#st_phone_container').fadeOut(200);
    });

        // --- Events สำหรับ Settings App (ภายในโทรศัพท์) ---

    // 1. คลิกไอคอน Settings เพื่อเปิดแอพ
    $(document).off('click', '.st-phone-app-icon[data-app="settings"]').on('click', '.st-phone-app-icon[data-app="settings"]', function() {
        renderSettingsApp();
    });

    // 2. เปลี่ยนวอลเปเปอร์
    $(document).on('input', '#app_setting_wallpaper', function() {
        const settings = extension_settings[extensionName];
        settings.wallpaper = this.value;
        saveSettingsDebounced();
        // อัปเดตช่อง input ในแผงควบคุมหลักของ SillyTavern ด้วยเผื่อเปิดไว้
        $('#st_phone_wallpaper').val(this.value);
    });

    // 3. เปลี่ยนสีกรอบโทรศัพท์
    $(document).on('input', '#app_setting_frame_color', function() {
        const settings = extension_settings[extensionName];
        settings.phoneColor = this.value;
        $('#st_phone_container').css('border-color', this.value);
        saveSettingsDebounced();
        $('#st_phone_color').val(this.value); // ซิงค์กับแผงควบคุมหลัก
    });

    // 4. เปลี่ยนสีไอคอนปุ่มลอย
    $(document).on('input', '#app_setting_icon_color', function() {
        const settings = extension_settings[extensionName];
        settings.iconColor = this.value;
        $('#st_phone_fab').css('color', this.value);
        saveSettingsDebounced();
        $('#st_phone_icon_color').val(this.value); // ซิงค์กับแผงควบคุมหลัก
    });

        // บันทึกรูปโปรไฟล์ User / Bot
    $(document).on('input', '#app_setting_user_avatar', function() {
        extension_settings[extensionName].userAvatar = this.value;
        saveSettingsDebounced();
    });
    $(document).on('input', '#app_setting_bot_avatar', function() {
        extension_settings[extensionName].botAvatar = this.value;
        saveSettingsDebounced();
    });

} //ปิดฟังก์ชัน setupEvents

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
// ดึงข้อมูลชื่อและรูป Avatar ของ Bot (รองรับการตั้งค่า Manual)
function getCharDetails() {
    const settings = extension_settings[extensionName];
    const context = getContext();
    const name = context.name2 || "Unknown";
    let avatarSrc = '';

    // ถ้ามีการตั้งค่ารูปลิงก์แบบ Manual ให้ใช้รูปนั้นก่อน
    if (settings.botAvatar && settings.botAvatar.trim() !== '') {
        avatarSrc = settings.botAvatar;
    } else if (context.characters && context.this_chid !== undefined && context.characters[context.this_chid]) {
        avatarSrc = `/characters/${context.characters[context.this_chid].avatar}`;
    } else {
        const domSrc = $('#avatar_url_sys').attr('src');
        if (domSrc && domSrc.trim() !== '') {
            avatarSrc = domSrc;
        } else {
            avatarSrc = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23ccc'/><circle cx='50' cy='40' r='20' fill='%23fff'/><path d='M20 100 Q50 60 80 100' stroke='%23fff' stroke-width='5' fill='none'/></svg>";
        }
    }
    return { name, avatarSrc };
}

// ดึงข้อมูลชื่อและรูป Avatar ของ User (รองรับการตั้งค่า Manual)
function getUserDetails() {
    const settings = extension_settings[extensionName];
    const context = getContext();
    const name = context.name1 || "You";
    let avatarSrc = '';

    if (settings.userAvatar && settings.userAvatar.trim() !== '') {
        avatarSrc = settings.userAvatar;
    } else {
        const domSrc = $('#avatar_url_user').attr('src');
        if (domSrc && domSrc.trim() !== '') {
            avatarSrc = domSrc;
        } else {
            avatarSrc = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23007AFF'/><circle cx='50' cy='40' r='20' fill='%23fff'/><path d='M20 100 Q50 60 80 100' stroke='%23fff' stroke-width='5' fill='none'/></svg>";
        }
    }
    return { name, avatarSrc };
}

// สร้างและแสดงผลหน้าจอหลัก (อัปเดตระบบจำจุดแดง)
function renderHomeScreen() {
    const settings = extension_settings[extensionName];
    const charDetails = getCharDetails();
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
                    <div class="st-phone-app-icon" data-app="message">
                        <div class="st-phone-app-bg" style="background-color: #25D366;"><i class="fa-solid fa-comment"></i></div>
                        <div class="st-phone-app-name">Message</div>
                        <div class="st-phone-app-badge" id="badge_message" style="display: ${appNotifications.message ? 'block' : 'none'};"></div>
                    </div>
                    <div class="st-phone-app-icon" data-app="insta">
                        <div class="st-phone-app-bg" style="background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);"><i class="fa-brands fa-instagram"></i></div>
                        <div class="st-phone-app-name">Insta</div>
                        <div class="st-phone-app-badge" id="badge_insta" style="display: ${appNotifications.insta ? 'block' : 'none'};"></div>
                    </div>
                    <div class="st-phone-app-icon" data-app="twitter">
                        <div class="st-phone-app-bg" style="background-color: #1DA1F2;"><i class="fa-brands fa-twitter"></i></div>
                        <div class="st-phone-app-name">Twitter</div>
                        <div class="st-phone-app-badge" id="badge_twitter" style="display: ${appNotifications.twitter ? 'block' : 'none'};"></div>
                    </div>
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

let appNotifications = { message: false, insta: false, twitter: false };

// ฟังก์ชันดึงประวัติแชทจาก SillyTavern มาแสดงในโทรศัพท์
function getPhoneHistory() {
    const context = getContext();
    const chat = context.chat || [];
    let msgHistory = [];

    chat.forEach(msg => {
        const text = msg.mes;
        if (!text) return;

        if (msg.is_user) {
            // ดึงข้อความฝั่งผู้ใช้
            const lines = text.split('\n');
            lines.forEach(line => {
                if (line.startsWith('${userDetails.name}: ')) msgHistory.push({ sender: 'user', type: 'text', text: line.replace('${userDetails.name}: ', '').trim() });
                else if (line.includes('[💸 ${userDetails.name} sent a Transfer Slip:')) {
                    const match = line.match(/Amount (.+?) to (.+?)\]/);
                    if (match) msgHistory.push({ sender: 'user', type: 'slip', amount: match[1], to: match[2] });
                } else if (line.includes('[📍 ${userDetails.name} shared a Location:')) {
                    const match = line.match(/Location: (.+?)\]/);
                    if (match) msgHistory.push({ sender: 'user', type: 'loc', place: match[1] });
                } else if (line.includes('[🎤 ${userDetails.name} sent a Voice Message:')) {
                    const match = line.match(/Voice Message: "(.+?)"\]/);
                    if (match) msgHistory.push({ sender: 'user', type: 'voice', text: match[1] });
                } else if (line.includes('[✨ ${userDetails.name} sent a Sticker:')) {
                    const match = line.match(/Sticker: "(.+?)"\]/);
                    if (match) msgHistory.push({ sender: 'user', type: 'sticker', name: match[1] });
                } else if (line.includes('[🖼️ ${userDetails.name} sent an Image:')) {
                    const match = line.match(/Image: "(.+?)"\]/);
                    if (match) msgHistory.push({ sender: 'user', type: 'image', name: match[1] });
                }
            });
        } else {
            // ดึงข้อความฝั่ง AI (ใช้ Regex เพื่อความแม่นยำ)
            let match;
            const msgRegex = /\[📱 Message:\s*(.+?)\]/gi;
            while ((match = msgRegex.exec(text)) !== null) msgHistory.push({ sender: 'ai', type: 'text', text: match[1] });

            const voiceRegex = /\[🎤 Voice:\s*"(.+?)"\]/gi;
            while ((match = voiceRegex.exec(text)) !== null) msgHistory.push({ sender: 'ai', type: 'voice', text: match[1] });

            const slipRegex = /\[💸 Slip:\s*Amount (.+?) to (.+?)\]/gi;
            while ((match = slipRegex.exec(text)) !== null) msgHistory.push({ sender: 'ai', type: 'slip', amount: match[1], to: match[2] });

            const stickerRegex = /\[✨ Sticker:\s*(.+?)\]/gi;
            while ((match = stickerRegex.exec(text)) !== null) msgHistory.push({ sender: 'ai', type: 'sticker', name: match[1] });

            const imageRegex = /\[🖼️ Image:\s*(.+?)\]/gi;
            while ((match = imageRegex.exec(text)) !== null) msgHistory.push({ sender: 'ai', type: 'image', name: match[1] });
        }
    });
    return msgHistory;
}

// ฟังก์ชันดึงประวัติ Insta จากแชทหลัก
function getInstaHistory() {
    const context = getContext();
    const chat = context.chat || [];
    let history = [];
    const userDetails = getUserDetails();
    const botDetails = getCharDetails();

    chat.forEach(msg => {
        const text = msg.mes;
        if (!text) return;

        if (msg.is_user) {
            // ดึงโพสต์ฝั่งผู้ใช้
            if (text.includes('[📸 Insta App - New Post by ${userDetails.name}]:')) {
                const imgMatch = text.match(/- Image: \[(.+?)\]/);
                const capMatch = text.match(/- Caption: "(.+?)"/);
                const statsMatch = text.match(/- Stats: (\d+) Likes \| (\d+) Comments/);
                if (imgMatch) {
                    history.push({
                        sender: 'user', type: 'post',
                        imgUrl: imgMatch[1],
                        caption: capMatch ? capMatch[1] : '',
                        likes: statsMatch ? statsMatch[1] : '0',
                        comments: statsMatch ? statsMatch[2] : '0',
                        avatar: userDetails.avatarSrc,
                        name: userDetails.name
                    });
                }
            }
        } else {
            // ดึงโพสต์และคอมเมนต์ฝั่ง AI
            let match;
            const postRegex = /\[📸 Insta Post:\s*Image (.+?)\s*\|\s*Caption "(.+?)"\s*\|\s*Likes (\d+)\]/gi;
            while ((match = postRegex.exec(text)) !== null) {
                history.push({
                    sender: 'ai', type: 'post',
                    imgUrl: match[1].includes('http') ? match[1] : 'https://via.placeholder.com/400?text=' + encodeURIComponent(match[1]),
                    caption: match[2],
                    likes: match[3],
                    comments: '0',
                    avatar: botDetails.avatarSrc,
                    name: botDetails.name
                });
            }
            const commentRegex = /\[💬 Insta Comment:\s*"(.+?)"\]/gi;
            while ((match = commentRegex.exec(text)) !== null) {
                history.push({ sender: 'ai', type: 'comment', text: match[1], avatar: botDetails.avatarSrc, name: botDetails.name });
            }
        }
    });
    return history;
}

// ฟังก์ชันดึงประวัติ Twitter จากแชทหลัก
function getTwitterHistory() {
    const context = getContext();
    const chat = context.chat || [];
    let history = [];
    const userDetails = getUserDetails();
    const botDetails = getCharDetails();
    const defaultBotUser = botDetails.name.replace(/\s+/g, '').toLowerCase();

    chat.forEach(msg => {
        const text = msg.mes;
        if (!text) return;

        if (msg.is_user) {
            // ดึงทวีตฝั่งผู้ใช้
            if (text.includes('[🐦 Twitter App - New Tweet]:')) {
                const nameMatch = text.match(/Name: (.+?) \(@(.+?)\) (\(Private Account\)|\(Public Account\))/);
                const tweetMatch = text.match(/Tweet: "(.+?)"/);
                const statsMatch = text.match(/Stats: (\d+) Replies \| (\d+) Retweets \| (\d+) Likes/);
                if (tweetMatch && nameMatch) {
                    history.push({
                        sender: 'user', type: 'tweet',
                        displayName: nameMatch[1],
                        username: nameMatch[2],
                        isPrivate: nameMatch[3].includes('Private'),
                        text: tweetMatch[1],
                        replies: statsMatch ? statsMatch[1] : '0',
                        retweets: statsMatch ? statsMatch[2] : '0',
                        likes: statsMatch ? statsMatch[3] : '0',
                        avatar: userDetails.avatarSrc
                    });
                }
            }
        } else {
            // ดึงทวีตและรีพลายฝั่ง AI
            let match;
            const tweetRegex = /\[🐦 Tweet:\s*"(.+?)"\]/gi;
            while ((match = tweetRegex.exec(text)) !== null) {
                history.push({
                    sender: 'ai', type: 'tweet',
                    displayName: botDetails.name,
                    username: defaultBotUser,
                    isPrivate: false,
                    text: match[1],
                    replies: '0', retweets: '0', likes: '0',
                    avatar: botDetails.avatarSrc
                });
            }
            const replyRegex = /\[💬 Tweet Reply:\s*"(.+?)"\]/gi;
            while ((match = replyRegex.exec(text)) !== null) {
                history.push({ sender: 'ai', type: 'reply', text: match[1], avatar: botDetails.avatarSrc, name: botDetails.name });
            }
        }
    });
    return history;
}

// ฟังก์ชันสร้างหน้าจอแชท (อัปเดตเพิ่ม Modal และ Menu)
// ฟังก์ชันสร้างหน้าจอแชท (รวมโค้ดทั้งหมดที่สมบูรณ์)
function renderMessageApp() {
    const charDetails = getCharDetails();
    const settings = extension_settings[extensionName];
    const wallpaperUrl = settings.wallpaper ? settings.wallpaper : charDetails.avatarSrc;

    const html = `
        <div class="st-phone-home-wrapper">
            <!-- วอลเปเปอร์ -->
            <div class="st-phone-wallpaper" style="background-image: url('${wallpaperUrl}');"></div>
            <div class="st-phone-wallpaper-overlay"></div>

            <!-- ส่วนหัว -->
            <div class="st-phone-app-header">
                <div class="st-phone-back-btn" title="Back"><i class="fa-solid fa-chevron-left"></i></div>
                <div class="st-phone-app-title">${charDetails.name}</div>
            </div>

            <!-- พื้นที่แชท (ส่วนนี้จะยืดหดและ Scroll ได้) -->
            <div class="st-phone-chat-area" id="st_phone_chat_history"></div>

            <!-- แถบพิมพ์ข้อความ (ล็อกอยู่ด้านล่างเสมอ) -->
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
    `;
    $('#st_phone_screen').html(html);
    updateChatDraftsUI();
}

// ฟังก์ชันอัปเดตบับเบิลแชท (อัปเดตรองรับ Slip, Loc, Voice)
// อัปเดตหน้าจอแชท (ดึงประวัติมาโชว์ก่อน แล้วค่อยโชว์ Draft)
function updateChatDraftsUI() {
    const chatArea = $('#st_phone_chat_history');
    chatArea.empty();

    const history = getPhoneHistory();
    const settings = extension_settings[extensionName];
    const lib = settings.mediaLibrary || { stickers: [], images: [] };

    // 1. วาดประวัติแชทของจริง
    history.forEach(msg => {
        let contentHtml = '';
        if (msg.type === 'text') {
            contentHtml = `<div class="${msg.sender === 'ai' ? 'st-phone-bubble-ai' : 'st-phone-bubble'}">${msg.text}</div>`;
        } else if (msg.type === 'voice') {
            contentHtml = `
                <div class="st-phone-bubble-voice">
                    <div class="st-phone-voice-play" onclick="$(this).next('.st-phone-voice-text').slideToggle();"><i class="fa-solid fa-circle-play"></i> Voice Message</div>
                    <div class="st-phone-voice-text">"${msg.text}"</div>
                </div>`;
        } else if (msg.type === 'slip') {
            contentHtml = `
                <div class="${msg.sender === 'ai' ? 'st-phone-bubble-ai-slip' : 'st-phone-bubble-slip'}">
                    <div style="font-size: 24px; margin-bottom: 5px;"><i class="fa-solid fa-circle-check"></i></div>
                    <div style="font-weight: bold;">Transfer Successful</div>
                    <div style="font-size: 13px; opacity: 0.9;">Amount: ${msg.amount}</div>
                    <div style="font-size: 13px; opacity: 0.9;">To: ${msg.to}</div>
                </div>`;
        } else if (msg.type === 'loc') {
            contentHtml = `<div class="st-phone-bubble-loc"><div style="font-size: 24px; margin-bottom: 5px;"><i class="fa-solid fa-map-location-dot"></i></div><div style="font-weight: bold;">Location Shared</div><div style="font-size: 13px; opacity: 0.9;">${msg.place}</div></div>`;
        } else if (msg.type === 'sticker' || msg.type === 'image') {
            let url = 'https://via.placeholder.com/150?text=Media';
            const found = [...lib.stickers, ...lib.images].find(x => x.name === msg.name);
            if (found) url = found.url;
            contentHtml = `<div class="st-phone-bubble-media"><img src="${url}" alt="${msg.name}"></div>`;
        }

        const wrapperClass = msg.sender === 'ai' ? 'st-phone-bubble-ai-wrapper' : 'st-phone-bubble-wrapper';
        chatArea.append(`<div class="${wrapperClass}">${contentHtml}</div>`);
    });

    // 2. วาดข้อความร่าง (Drafts)
    if (messageDrafts.length > 0) {
        chatArea.append(`<div style="text-align:center; font-size:12px; color:#999; margin:15px 0;">--- Drafts ---</div>`);
        messageDrafts.forEach((draft, index) => {
            let contentHtml = '';
            if (draft.type === 'text') contentHtml = `<div class="st-phone-bubble" style="opacity:0.7;">${draft.text}</div>`;
            else if (draft.type === 'slip') contentHtml = `<div class="st-phone-bubble-slip" style="opacity:0.7;">Transfer: ${draft.amount} to ${draft.to}</div>`;
            else if (draft.type === 'loc') contentHtml = `<div class="st-phone-bubble-loc" style="opacity:0.7;">Location: ${draft.place}</div>`;
            else if (draft.type === 'voice') contentHtml = `<div class="st-phone-bubble-voice" style="opacity:0.7;">Voice: "${draft.text}"</div>`;
            else if (draft.type === 'sticker' || draft.type === 'image') contentHtml = `<div class="st-phone-bubble-media" style="opacity:0.7;"><img src="${draft.url}"></div>`;

            chatArea.append(`
                <div class="st-phone-bubble-wrapper">
                    ${contentHtml}
                    <div class="st-phone-bubble-delete" data-index="${index}"><i class="fa-solid fa-trash"></i> Delete</div>
                </div>
            `);
        });
    }

    if (history.length === 0 && messageDrafts.length === 0) {
        chatArea.append(`<div style="text-align: center; color: #999; margin-top: 20px; font-family: sans-serif; font-size: 13px;">No messages yet.</div>`);
    }

    chatArea.scrollTop(chatArea[0].scrollHeight);
}

// --- Phase 4: Insta App ---
let instaDrafts = []; // อาร์เรย์เก็บโพสต์ที่เตรียมจะส่ง

// ฟังก์ชันสร้างหน้าจอ Insta (อัปเดตเพิ่ม Modal ที่หายไป)
function renderInstaApp() {
    const html = `
        <div class="st-phone-home-wrapper" style="background-color: #ffffff; z-index: 5;">
            <div class="st-phone-insta-header">
                <div class="st-phone-back-btn" style="color:#262626;" title="Back"><i class="fa-solid fa-chevron-left"></i></div>
                <div class="st-phone-insta-logo">Insta</div>
                <div class="st-phone-insta-actions">
                    <i class="fa-regular fa-square-plus" id="st_phone_insta_add" title="Create Post"></i>
                </div>
            </div>

            <div class="st-phone-insta-feed" id="st_phone_insta_feed"></div>

            <div class="st-phone-input-area" style="border-top: 1px solid #efefef; padding: 10px 15px; background: #fff; z-index: 10;">
                <div class="st-phone-export-btn" id="st_phone_insta_export" style="background-color: #E1306C;">Send Posts to Chat Input</div>
            </div>

            <!-- หน้าต่าง Modal สำหรับกรอกข้อมูล (ต้องใส่ไว้ในแอพนี้ด้วย) -->
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
    updateInstaDraftsUI();
}

// ฟังก์ชันอัปเดตหน้าฟีด Insta
// อัปเดตหน้าฟีด Insta (แสดงประวัติ + Draft)
function updateInstaDraftsUI() {
    const feedArea = $('#st_phone_insta_feed');
    feedArea.empty();

    const history = getInstaHistory();
    const userDetails = getUserDetails();

    // วาดประวัติโพสต์และคอมเมนต์
    history.forEach(item => {
        if (item.type === 'post') {
            feedArea.prepend(`
                <div class="st-phone-insta-post">
                    <div class="st-phone-insta-post-header">
                        <img src="${item.avatar}" class="st-phone-insta-post-avatar">
                        <div class="st-phone-insta-post-user">${item.name}</div>
                    </div>
                    <img src="${item.imgUrl}" class="st-phone-insta-post-img" onerror="this.src='https://via.placeholder.com/400?text=Image+Not+Found'">
                    <div class="st-phone-insta-post-body">
                        <div class="st-phone-insta-post-icons"><i class="fa-regular fa-heart"></i> <i class="fa-regular fa-comment"></i> <i class="fa-regular fa-paper-plane"></i></div>
                        <div class="st-phone-insta-post-likes">${item.likes} likes • ${item.comments} comments</div>
                        <div class="st-phone-insta-post-caption"><span>${item.name}</span> ${item.caption}</div>
                    </div>
                </div>
            `);
        } else if (item.type === 'comment') {
            feedArea.prepend(`
                <div style="padding: 10px 15px; border-bottom: 1px solid #efefef; display: flex; gap: 10px; background: #fafafa;">
                    <img src="${item.avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">
                    <div style="font-size:13px; font-family:sans-serif; color:#262626;"><b>${item.name}</b> commented: "${item.text}"</div>
                </div>
            `);
        }
    });

    // วาด Draft
    if (instaDrafts.length > 0) {
        feedArea.prepend(`<div style="text-align:center; font-size:12px; color:#999; margin:15px 0;">--- Drafts ---</div>`);
        instaDrafts.forEach((draft, index) => {
            feedArea.prepend(`
                <div class="st-phone-insta-post" style="opacity: 0.7;">
                    <div class="st-phone-insta-post-header">
                        <img src="${userDetails.avatarSrc}" class="st-phone-insta-post-avatar">
                        <div class="st-phone-insta-post-user">${userDetails.name}</div>
                    </div>
                    <img src="${draft.imgUrl}" class="st-phone-insta-post-img" onerror="this.src='https://via.placeholder.com/400?text=Image'">
                    <div class="st-phone-insta-post-body">
                        <div class="st-phone-insta-post-likes">${draft.likes} likes</div>
                        <div class="st-phone-insta-post-caption"><span>${userDetails.name}</span> ${draft.caption}</div>
                        <div class="st-phone-insta-post-delete" data-index="${index}"><i class="fa-solid fa-trash"></i> Delete Draft</div>
                    </div>
                </div>
            `);
        });
    }

    if (history.length === 0 && instaDrafts.length === 0) {
        feedArea.append(`<div style="text-align: center; color: #999; margin-top: 50px; font-family: sans-serif; font-size: 14px;">No posts yet.<br>Click '+' to create a new post.</div>`);
    }
}

// --- Phase 5: Twitter App ---
let twitterDrafts = [];

// ฟังก์ชันสร้างหน้าจอ Twitter
function renderTwitterApp() {
    const settings = extension_settings[extensionName];
    // ตรวจสอบธีม (ค่าเริ่มต้นคือ Light)
    const isDark = settings.twitterTheme === 'dark';
    const darkClass = isDark ? 'dark-mode' : '';
    const themeIcon = isDark ? 'fa-sun' : 'fa-moon';

    const html = `
        <div class="st-phone-tw-wrapper ${darkClass}" id="st_phone_tw_wrapper">
            <div class="st-phone-tw-header">
                <div class="st-phone-back-btn" title="Back"><i class="fa-solid fa-chevron-left"></i></div>
                <div class="st-phone-tw-logo"><i class="fa-brands fa-twitter"></i></div>
                <div class="st-phone-tw-actions">
                    <i class="fa-solid ${themeIcon}" id="st_phone_tw_theme" title="Toggle Theme"></i>
                    <i class="fa-solid fa-feather-pointed" id="st_phone_tw_add" title="Tweet"></i>
                </div>
            </div>

            <div class="st-phone-tw-feed" id="st_phone_tw_feed"></div>

            <div class="st-phone-tw-input-area">
                <div class="st-phone-export-btn" id="st_phone_tw_export" style="background-color: #1DA1F2;">Send Tweets to Chat Input</div>
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
    updateTwitterDraftsUI();
}

// ฟังก์ชันอัปเดตหน้าฟีด Twitter
// อัปเดตหน้าฟีด Twitter (แสดงประวัติ + Draft)
function updateTwitterDraftsUI() {
    const feedArea = $('#st_phone_tw_feed');
    feedArea.empty();

    const history = getTwitterHistory();
    const userDetails = getUserDetails();

    // วาดประวัติทวีตและรีพลาย
    history.forEach(item => {
        if (item.type === 'tweet') {
            const privateIcon = item.isPrivate ? `<i class="fa-solid fa-lock st-phone-tw-private-icon"></i>` : '';
            feedArea.prepend(`
                <div class="st-phone-tw-post">
                    <img src="${item.avatar}" class="st-phone-tw-avatar">
                    <div class="st-phone-tw-content">
                        <div class="st-phone-tw-user-info">
                            <span class="st-phone-tw-display-name">${item.displayName}</span>
                            <span class="st-phone-tw-username">@${item.username}</span>
                            ${privateIcon}
                        </div>
                        <div class="st-phone-tw-text">${item.text}</div>
                        <div class="st-phone-tw-stats">
                            <div><i class="fa-regular fa-comment"></i> ${item.replies}</div>
                            <div><i class="fa-solid fa-retweet"></i> ${item.retweets}</div>
                            <div><i class="fa-regular fa-heart"></i> ${item.likes}</div>
                        </div>
                    </div>
                </div>
            `);
        } else if (item.type === 'reply') {
            feedArea.prepend(`
                <div style="padding: 10px 15px; border-bottom: 1px solid #eff3f4; display: flex; gap: 10px; background: rgba(29, 161, 242, 0.05);">
                    <img src="${item.avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">
                    <div style="font-size:14px; font-family:sans-serif;"><b>${item.name}</b> replied: "${item.text}"</div>
                </div>
            `);
        }
    });

    // วาด Draft
    if (twitterDrafts.length > 0) {
        feedArea.prepend(`<div style="text-align:center; font-size:12px; color:#999; margin:15px 0;">--- Drafts ---</div>`);
        twitterDrafts.forEach((draft, index) => {
            const privateIcon = draft.isPrivate ? `<i class="fa-solid fa-lock st-phone-tw-private-icon"></i>` : '';
            feedArea.prepend(`
                <div class="st-phone-tw-post" style="opacity: 0.7;">
                    <img src="${userDetails.avatarSrc}" class="st-phone-tw-avatar">
                    <div class="st-phone-tw-content">
                        <div class="st-phone-tw-user-info">
                            <span class="st-phone-tw-display-name">${draft.displayName}</span>
                            <span class="st-phone-tw-username">@${draft.username}</span>
                            ${privateIcon}
                        </div>
                        <div class="st-phone-tw-text">${draft.text}</div>
                        <div class="st-phone-tw-delete" data-index="${index}"><i class="fa-solid fa-trash"></i> Delete Draft</div>
                    </div>
                </div>
            `);
        });
    }

    if (history.length === 0 && twitterDrafts.length === 0) {
        feedArea.append(`<div style="text-align: center; opacity: 0.6; margin-top: 50px; font-family: sans-serif; font-size: 14px;">No tweets yet.<br>Click the feather icon to tweet.</div>`);
    }
}

// --- Phase 6: System Prompt & Notifications ---

// ฟังก์ชันอัปเดตคำสั่งสอน AI เบื้องหลัง (System Prompt)
function updateSystemPrompt() {
    const settings = extension_settings[extensionName];
    const library = settings.mediaLibrary || { stickers: [], images: [] };

    // ดึงรายชื่อสติกเกอร์และรูปภาพมาให้ AI รู้จัก
    const stickerNames = library.stickers.map(s => s.name).join(', ') || 'None';
    const imageNames = library.images.map(i => i.name).join(', ') || 'None';

    // สร้าง Prompt สอน AI (กระชับและเข้าใจง่าย)
    const promptString = `
[📱 Smart Phone Extension Active]
You have a smartphone. You can interact with the user via apps using these EXACT formats anywhere in your response:
- Message: [📱 Message: <your text>]
- Voice Message: [🎤 Voice: "<your text>"]
- Transfer Slip: [💸 Slip: Amount <number> to User]
- Send Sticker: [✨ Sticker: <name>] (Available in library: ${stickerNames})
- Send Image: [🖼️ Image: <name>] (Available in library: ${imageNames})
- Insta Post: [📸 Insta Post: Image <url/name> | Caption "<text>" | Likes <number>]
- Insta Comment: [💬 Insta Comment: "<text>"]
- Tweet: [🐦 Tweet: "<text>"]
- Tweet Reply: [💬 Tweet Reply: "<text>"]
Feel free to use these tags naturally to simulate using your phone!
    `.trim();

    // ส่ง Prompt เข้าสู่ระบบ (0 = IN_PROMPT, 1 = Depth, true = Add newline, 0 = SYSTEM ROLE)
    setExtensionPrompt(extensionName, promptString, 0, 1, true, 0);
}

// ฟังก์ชันตรวจจับข้อความจาก AI และแจ้งเตือนจุดแดง
// ฟังก์ชันตรวจจับข้อความจาก AI (แก้บั๊กจุดแดงด้วย Regex + หน่วงเวลาให้ชัวร์)
function handleIncomingMessage() {
    setTimeout(() => {
        const context = getContext();
        const chat = context.chat;
        if (!chat || chat.length === 0) return;

        const lastMessage = chat[chat.length - 1];
        if (lastMessage.is_user) return;

        const text = lastMessage.mes;
        let hasNotification = false;

        // ใช้ Regex (i) เพื่อจับคำให้แม่นยำขึ้น
        if (/\[📱 Message:/i.test(text) || /\[🎤 Voice:/i.test(text) || /\[💸 Slip:/i.test(text) || /\[✨ Sticker:/i.test(text) || /\[🖼️ Image:/i.test(text)) {
            appNotifications.message = true;
            $('#badge_message').show();
            hasNotification = true;
        }
        if (/\[📸 Insta Post:/i.test(text) || /\[💬 Insta Comment:/i.test(text)) {
            appNotifications.insta = true;
            $('#badge_insta').show();
            hasNotification = true;
        }
        if (/\[🐦 Tweet:/i.test(text) || /\[💬 Tweet Reply:/i.test(text)) {
            appNotifications.twitter = true;
            $('#badge_twitter').show();
            hasNotification = true;
        }

        if (hasNotification) {
            triggerNotification();
            // ถ้าผู้ใช้เปิดหน้าแชทค้างไว้อยู่ ให้อัปเดตข้อความใหม่ทันที!
            if ($('#st_phone_chat_history').length) updateChatDraftsUI();
        }
    }, 1000); // หน่วงเวลา 1 วิ เพื่อให้ข้อความโหลดเข้าแชทหลักเสร็จสมบูรณ์
}

// --- Phase 7: Settings App (ภายในโทรศัพท์) ---

// ฟังก์ชันสร้างหน้าจอ Settings (อัปเดตเพิ่มช่องใส่รูป User/Bot)
function renderSettingsApp() {
    const settings = extension_settings[extensionName];

    const html = `
        <div class="st-phone-settings-wrapper">
            <div class="st-phone-settings-header">
                <div class="st-phone-back-btn" style="color:#007AFF;" title="Back"><i class="fa-solid fa-chevron-left"></i></div>
                <div class="st-phone-settings-title">Settings</div>
            </div>

            <div class="st-phone-settings-body">
                <div style="font-size: 13px; color: #8e8e93; margin-bottom: 8px; margin-left: 10px; text-transform: uppercase;">Profiles & Appearance</div>
                <div class="st-phone-settings-group">
                    <div class="st-phone-settings-item">
                        <div style="display:flex; align-items:center; color:#007AFF;"><i class="fa-solid fa-user"></i> User Avatar URL</div>
                        <input type="text" id="app_setting_user_avatar" class="st-phone-settings-input" value="${settings.userAvatar || ''}" placeholder="Leave blank for Default">
                    </div>
                    <div class="st-phone-settings-item">
                        <div style="display:flex; align-items:center; color:#FF2D55;"><i class="fa-solid fa-robot"></i> Bot Avatar URL</div>
                        <input type="text" id="app_setting_bot_avatar" class="st-phone-settings-input" value="${settings.botAvatar || ''}" placeholder="Leave blank for Default">
                    </div>
                    <div class="st-phone-settings-item">
                        <div style="display:flex; align-items:center; color:#5856D6;"><i class="fa-solid fa-image"></i> Wallpaper URL</div>
                        <input type="text" id="app_setting_wallpaper" class="st-phone-settings-input" value="${settings.wallpaper || ''}" placeholder="Leave blank for Bot Avatar">
                    </div>
                </div>

                <div style="font-size: 13px; color: #8e8e93; margin-bottom: 8px; margin-left: 10px; text-transform: uppercase;">Colors</div>
                <div class="st-phone-settings-group">
                    <div class="st-phone-settings-item">
                        <div style="display:flex; align-items:center; color:#FF9500;"><i class="fa-solid fa-mobile-screen"></i> Frame Color</div>
                        <input type="color" id="app_setting_frame_color" class="st-phone-color-picker" value="${settings.phoneColor}">
                    </div>
                    <div class="st-phone-settings-item">
                        <div style="display:flex; align-items:center; color:#34C759;"><i class="fa-solid fa-circle-dot"></i> Icon Color</div>
                        <input type="color" id="app_setting_icon_color" class="st-phone-color-picker" value="${settings.iconColor}">
                    </div>
                </div>
            </div>
        </div>
    `;
    $('#st_phone_screen').html(html);
}

// เริ่มต้นการทำงานเมื่อโหลดสคริปต์
jQuery(async () => {
    await initUI();
});
