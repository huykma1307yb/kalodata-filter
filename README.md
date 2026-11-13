# Kalodata Product Filter (Chrome extension)

Lọc và xếp hạng sản phẩm / ngành hàng trên kalodata.com ngay trong trình duyệt (dùng tài khoản Kalodata bạn đã đăng nhập), có ra lệnh và phân tích bằng Claude.

## Cài đặt
1. Giải nén (nếu nhận file zip) → được thư mục `kalodata-filter`, để ở chỗ cố định.
2. Mở `chrome://extensions`, bật **Developer mode**.
3. Bấm **Load unpacked** → chọn thư mục `kalodata-filter`.
4. **Details → Extension options**: dán Claude API key (tạo ở console.anthropic.com), bấm Lưu. Model mặc định `claude-opus-5-5`; muốn rẻ hơn dùng `claude-haiku-5-5`.
5. Vào kalodata.com → bấm icon **K** trên thanh công cụ (hoặc nút **🔍 Lọc sản phẩm** góc phải dưới).

Cập nhật bản mới: thay thư mục → `chrome://extensions` bấm **↻ Reload** → F5 trang Kalodata. Số phiên bản hiện cạnh chữ "Ra lệnh" trong panel.

## Tính năng
### ⚡ Ra lệnh (cần API key)
Gõ yêu cầu tiếng Việt, ví dụ:
> top sản phẩm tăng trưởng mạnh nhất 7 ngày, giá từ 50k đến 200k, trừ nước xả vải

Claude hiểu lệnh rồi extension tự: mở trang/tab phù hợp, chọn khoảng thời gian, áp loại trừ / giá / điều kiện, gom kết quả qua nhiều trang, xếp hạng và phân tích.

### Lọc sản phẩm (không cần API key)
- **Luôn loại trừ**: từ khoá trong tên sản phẩm cần bỏ, cách nhau dấu phẩy. Hỗ trợ ngoại lệ: `điện tử (trừ phụ kiện)`.
- **Giới hạn giá bán** Min/Max (lấy giá dưới tên sản phẩm; khoảng giá → giá thấp nhất).
- Min/Max cho mọi cột số (doanh thu, tăng trưởng, lượt bán...). Hiểu `50k`, `1.5tr`, `2tỉ`, `10%`.
- Bấm **Áp dụng**: tự lật tối đa 10 trang, ẩn sản phẩm bị loại và đưa sản phẩm hợp lệ từ mọi trang lên đầu trang 1 (đã xếp hạng). Bấm vào sản phẩm (trong bảng hoặc danh sách ở panel) để mở trang chi tiết ở tab mới.
- Dòng trạng thái ghi rõ đã đọc bao nhiêu trang và lý do từng nhóm sản phẩm bị loại.
- **Xoá lọc**: trả bảng Kalodata về như cũ. **Xuất CSV**: tải kết quả.

### 🤖 Hỏi AI (cần API key)
Câu hỏi mẫu (Top 5 tiềm năng, Tóm tắt xu hướng, Tìm bất thường) hoặc tự nhập. Gửi tối đa 100 sản phẩm của kết quả lọc tới `api.anthropic.com`.

## Lưu ý
- API key lưu trong `chrome.storage.local` của máy bạn, không nằm trong file extension — người nhận cần key riêng.
- Đặt số dòng/trang của Kalodata lớn nhất để gom được nhiều sản phẩm hơn.
- Extension dựa vào giao diện Kalodata; nếu Kalodata đổi giao diện, một số bước tự động (chọn thời gian, chuyển trang) có thể cần chỉnh lại.
