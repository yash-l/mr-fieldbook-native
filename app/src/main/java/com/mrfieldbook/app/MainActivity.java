package com.mrfieldbook.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.location.Location;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int REQ_DOCTOR = 8201;
    private static final int REQ_CHEMIST = 8202;
    private static final int REQ_IMPORT = 8203;

    private Db db;
    private FrameLayout pageHost;
    private final Button[] navButtons = new Button[5];
    private int currentPage;

    private Models.Doctor selectedDoctor;
    private double visitLat;
    private double visitLng;
    private long followUpAt;
    private TextView gpsStatus;
    private TextView selectedDoctorInfo;
    private LinearLayout productContainer;
    private EditText visitNotes;
    private Button followUpButton;
    private final Map<Long, RadioGroup> productGroups = new LinkedHashMap<>();

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        db = new Db(this);
        AppLock.requireUnlock(this, db, () -> {
            buildShell();
            requestNotificationsIfNeeded();
            long doctorId = getIntent().getLongExtra("doctor_id", 0);
            if (doctorId > 0) {
                Models.Doctor doctor = db.getDoctor(doctorId);
                if (doctor != null) {
                    switchPage(0);
                    selectDoctor(doctor, true);
                }
            }
        });
    }

    private void buildShell() {
        LinearLayout root = Ui.vertical(this);
        root.setBackgroundColor(Ui.BG);

        LinearLayout header = Ui.vertical(this);
        header.setPadding(Ui.dp(this, 18), Ui.dp(this, 14), Ui.dp(this, 18), Ui.dp(this, 12));
        TextView brand = Ui.title(this, "MR FieldBook");
        header.addView(brand);
        TextView sub = Ui.text(this, db.getSetting("hq", "Rajkot") + " · " + new SimpleDateFormat("EEE, dd MMM", Locale.getDefault()).format(new Date()), 13, Ui.MUTED);
        header.addView(sub);
        root.addView(header, Ui.matchWrap(this));

        pageHost = new FrameLayout(this);
        root.addView(pageHost, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout nav = Ui.horizontal(this);
        nav.setPadding(Ui.dp(this, 6), Ui.dp(this, 6), Ui.dp(this, 6), Ui.dp(this, 8));
        nav.setBackgroundColor(Color.WHITE);
        String[] names = {"＋ Log", "Doctors", "Today", "Route", "More"};
        for (int i = 0; i < names.length; i++) {
            final int index = i;
            Button button = Ui.ghost(this, names[i]);
            button.setTextSize(12);
            button.setMinHeight(Ui.dp(this, 48));
            button.setOnClickListener(v -> switchPage(index));
            navButtons[i] = button;
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
            if (i > 0) params.setMargins(Ui.dp(this, 4), 0, 0, 0);
            nav.addView(button, params);
        }
        root.addView(nav, Ui.matchWrap(this));
        setContentView(root);
        switchPage(0);
    }

    private void switchPage(int page) {
        currentPage = page;
        for (int i = 0; i < navButtons.length; i++) {
            Button b = navButtons[i];
            if (b == null) continue;
            if (i == page) {
                b.setTextColor(Color.WHITE);
                b.setBackground(Ui.round(this, Ui.BRAND, Ui.BRAND, 12));
            } else {
                b.setTextColor(Ui.TEXT);
                b.setBackground(Ui.round(this, Color.WHITE, Ui.BORDER, 12));
            }
        }
        pageHost.removeAllViews();
        View view;
        if (page == 0) view = buildLogPage();
        else if (page == 1) view = buildDoctorsPage();
        else if (page == 2) view = buildTodayPage();
        else if (page == 3) view = buildRoutePage();
        else view = buildMorePage();
        pageHost.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private ScrollView pageScroll(LinearLayout content) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        content.setPadding(Ui.dp(this, 16), Ui.dp(this, 8), Ui.dp(this, 16), Ui.dp(this, 30));
        scroll.addView(content);
        return scroll;
    }

    private View buildLogPage() {
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.title(this, "Log a doctor meeting"));
        TextView lead = Ui.text(this, "Search doctor or hospital. Address, chemist, timing, date and previous product status load automatically.", 13, Ui.MUTED);
        body.addView(lead);
        Ui.spacer(body, 12);

        EditText search = Ui.edit(this, "Search doctor or hospital name");
        search.setCompoundDrawablesWithIntrinsicBounds(android.R.drawable.ic_menu_search, 0, 0, 0);
        search.setCompoundDrawablePadding(Ui.dp(this, 8));
        body.addView(search, Ui.matchWrap(this));
        LinearLayout results = Ui.vertical(this);
        body.addView(results, Ui.matchWrap(this));

        selectedDoctorInfo = Ui.text(this, "No doctor selected", 14, Ui.MUTED);
        LinearLayout selectedCard = Ui.card(this);
        selectedCard.addView(Ui.label(this, "Selected doctor"));
        selectedCard.addView(selectedDoctorInfo);
        body.addView(selectedCard, Ui.matchWrap(this));
        Ui.margin(selectedCard, 0, 12, 0, 0);

        LinearLayout gpsCard = Ui.card(this);
        LinearLayout gpsRow = Ui.horizontal(this);
        gpsStatus = Ui.text(this, "GPS will fetch after doctor selection", 13, Ui.MUTED);
        gpsRow.addView(gpsStatus, Ui.weight(1));
        Button gps = Ui.secondary(this, "Fetch GPS");
        gps.setOnClickListener(v -> fetchVisitGps());
        gpsRow.addView(gps);
        gpsCard.addView(Ui.label(this, "Meeting location"));
        gpsCard.addView(gpsRow);
        body.addView(gpsCard, Ui.matchWrap(this));
        Ui.margin(gpsCard, 0, 10, 0, 0);

        TextView productHeading = Ui.section(this, "Product feedback");
        body.addView(productHeading);
        LinearLayout quick = Ui.horizontal(this);
        Button allNoFeedback = Ui.ghost(this, "All: No feedback");
        allNoFeedback.setOnClickListener(v -> setAllProductStatus(3));
        Button allPrescribed = Ui.secondary(this, "All: Prescribed");
        allPrescribed.setOnClickListener(v -> setAllProductStatus(1));
        quick.addView(allNoFeedback, Ui.weight(1));
        LinearLayout.LayoutParams quick2 = Ui.weight(1);
        quick2.setMargins(Ui.dp(this, 8), 0, 0, 0);
        quick.addView(allPrescribed, quick2);
        body.addView(quick, Ui.matchWrap(this));
        Ui.spacer(body, 8);
        productContainer = Ui.vertical(this);
        body.addView(productContainer, Ui.matchWrap(this));
        renderProducts();

        body.addView(Ui.section(this, "Optional meeting note"));
        visitNotes = Ui.notes(this, "Only enter something new; previous master details stay saved");
        body.addView(visitNotes, Ui.matchWrap(this));
        Ui.spacer(body, 10);

        followUpButton = Ui.secondary(this, "Set follow-up reminder");
        followUpButton.setOnClickListener(v -> pickFollowUp());
        body.addView(followUpButton, Ui.matchWrap(this));
        Ui.spacer(body, 12);

        Button save = Ui.button(this, "Save meeting + 1 call");
        save.setTextSize(16);
        save.setOnClickListener(v -> saveMeeting());
        body.addView(save, Ui.matchWrap(this));

        TextWatcher watcher = new SimpleWatcher() {
            @Override public void afterTextChanged(Editable s) {
                renderDoctorSearchResults(results, s.toString(), doctor -> {
                    selectDoctor(doctor, true);
                    search.setText(doctor.title());
                    search.setSelection(search.length());
                    results.removeAllViews();
                }, 12);
            }
        };
        search.addTextChangedListener(watcher);

        if (selectedDoctor != null) updateSelectedDoctorCard();
        return pageScroll(body);
    }

    private void renderDoctorSearchResults(LinearLayout target, String query, DoctorAction action, int limit) {
        target.removeAllViews();
        if (query == null || query.trim().length() < 1) return;
        List<Models.Doctor> doctors = db.searchDoctors(query, limit);
        for (Models.Doctor doctor : doctors) {
            LinearLayout row = Ui.card(this);
            TextView name = Ui.text(this, doctor.title(), 15, Ui.TEXT);
            name.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            row.addView(name);
            String detail = (doctor.chemistName.isEmpty() ? "No chemist linked" : doctor.chemistName) + " · " + doctor.timingText();
            row.addView(Ui.text(this, detail, 12, Ui.MUTED));
            row.setOnClickListener(v -> action.run(doctor));
            target.addView(row, Ui.matchWrap(this));
            Ui.margin(row, 0, 6, 0, 0);
        }
        if (doctors.isEmpty()) {
            TextView none = Ui.text(this, "No match. Add a doctor from Doctors tab.", 13, Ui.MUTED);
            none.setPadding(Ui.dp(this, 8), Ui.dp(this, 12), Ui.dp(this, 8), Ui.dp(this, 4));
            target.addView(none);
        }
    }

    private void selectDoctor(Models.Doctor doctor, boolean autoGps) {
        selectedDoctor = doctor;
        visitLat = 0;
        visitLng = 0;
        followUpAt = 0;
        if (visitNotes != null) visitNotes.setText("");
        if (followUpButton != null) followUpButton.setText("Set follow-up reminder");
        updateSelectedDoctorCard();
        renderProducts();
        if (autoGps && gpsStatus != null) fetchVisitGps();
    }

    private void updateSelectedDoctorCard() {
        if (selectedDoctorInfo == null) return;
        if (selectedDoctor == null) {
            selectedDoctorInfo.setText("No doctor selected");
            return;
        }
        StringBuilder text = new StringBuilder();
        text.append(selectedDoctor.title());
        if (!selectedDoctor.address.isEmpty()) text.append("\n").append(selectedDoctor.address);
        text.append("\nChemist: ").append(selectedDoctor.chemistName.isEmpty() ? "Not linked" : selectedDoctor.chemistName);
        text.append("\nTiming: ").append(selectedDoctor.timingText());
        text.append("\nStatus: ").append(ScheduleUtils.isAvailableNow(selectedDoctor) ? "Available now" : ScheduleUtils.badge(selectedDoctor));
        selectedDoctorInfo.setText(text.toString());
        selectedDoctorInfo.setTextColor(Ui.TEXT);
    }

    private void renderProducts() {
        if (productContainer == null) return;
        productContainer.removeAllViews();
        productGroups.clear();
        List<Models.Product> products = db.products(true);
        Map<Long, String> previous = selectedDoctor == null ? new HashMap<>() : db.lastProductStatuses(selectedDoctor.id);
        for (Models.Product product : products) {
            LinearLayout card = Ui.card(this);
            LinearLayout titleRow = Ui.horizontal(this);
            TextView title = Ui.text(this, product.name, 14, Ui.TEXT);
            title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            titleRow.addView(title, Ui.weight(1));
            String prior = previous.get(product.id);
            if (prior != null) {
                String priorText = "Last: " + ("P".equals(prior) ? "Prescribed" : "N".equals(prior) ? "Not prescribed" : "No feedback");
                titleRow.addView(Ui.pill(this, priorText, "P".equals(prior) ? Ui.SUCCESS : "N".equals(prior) ? Ui.DANGER : Ui.MUTED));
            }
            card.addView(titleRow);
            RadioGroup group = new RadioGroup(this);
            group.setOrientation(RadioGroup.HORIZONTAL);
            RadioButton p = radio("Prescribed", 1);
            RadioButton n = radio("Not prescribed", 2);
            RadioButton f = radio("No feedback", 3);
            group.addView(p, new RadioGroup.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            group.addView(n, new RadioGroup.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            group.addView(f, new RadioGroup.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            group.check(3);
            card.addView(group);
            productGroups.put(product.id, group);
            productContainer.addView(card, Ui.matchWrap(this));
            Ui.margin(card, 0, 0, 0, 8);
        }
        if (products.isEmpty()) productContainer.addView(Ui.text(this, "No active products. Add products under More.", 13, Ui.MUTED));
    }

    private RadioButton radio(String label, int id) {
        RadioButton button = new RadioButton(this);
        button.setId(id);
        button.setText(label);
        button.setTextSize(11);
        button.setTextColor(Ui.TEXT);
        button.setButtonTintList(android.content.res.ColorStateList.valueOf(Ui.BRAND));
        return button;
    }

    private void setAllProductStatus(int id) {
        for (RadioGroup group : productGroups.values()) group.check(id);
    }

    private void fetchVisitGps() {
        if (gpsStatus == null) return;
        gpsStatus.setText("Fetching current GPS…");
        gpsStatus.setTextColor(Ui.MUTED);
        LocationHelper.fetch(this, new LocationHelper.Callback() {
            @Override public void onLocation(Location location) {
                visitLat = location.getLatitude();
                visitLng = location.getLongitude();
                gpsStatus.setText(String.format(Locale.US, "GPS captured: %.5f, %.5f", visitLat, visitLng));
                gpsStatus.setTextColor(Ui.SUCCESS);
            }
            @Override public void onError(String message) {
                gpsStatus.setText(message);
                gpsStatus.setTextColor(Ui.DANGER);
            }
        });
    }

    private void pickFollowUp() {
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.DAY_OF_MONTH, 1);
        new DatePickerDialog(this, (view, year, month, day) -> {
            Calendar chosen = Calendar.getInstance();
            chosen.set(year, month, day, 10, 0, 0);
            new TimePickerDialog(this, (timeView, hour, minute) -> {
                chosen.set(Calendar.HOUR_OF_DAY, hour);
                chosen.set(Calendar.MINUTE, minute);
                chosen.set(Calendar.SECOND, 0);
                chosen.set(Calendar.MILLISECOND, 0);
                followUpAt = chosen.getTimeInMillis();
                followUpButton.setText("Follow-up: " + Models.formatDateTime(followUpAt));
            }, 10, 0, false).show();
        }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH), calendar.get(Calendar.DAY_OF_MONTH)).show();
    }

    private void saveMeeting() {
        if (selectedDoctor == null) {
            Ui.toast(this, "Search and select a doctor first");
            return;
        }
        Map<Long, String> statuses = new LinkedHashMap<>();
        for (Map.Entry<Long, RadioGroup> entry : productGroups.entrySet()) {
            int id = entry.getValue().getCheckedRadioButtonId();
            statuses.put(entry.getKey(), id == 1 ? "P" : id == 2 ? "N" : "F");
        }
        Runnable save = () -> {
            long now = System.currentTimeMillis();
            long visitId = db.saveVisit(selectedDoctor.id, selectedDoctor.chemistId, now, visitLat, visitLng,
                    visitNotes == null ? "" : visitNotes.getText().toString(), followUpAt, statuses);
            if (followUpAt > now) ReminderScheduler.schedule(this, visitId, selectedDoctor.id, followUpAt);
            Ui.toast(this, "Meeting saved · Today calls: " + db.todayCalls());
            selectedDoctor = null;
            visitLat = visitLng = 0;
            followUpAt = 0;
            switchPage(0);
        };
        if (visitLat == 0 && visitLng == 0) {
            new AlertDialog.Builder(this)
                    .setTitle("GPS not captured")
                    .setMessage("Save this meeting without GPS?")
                    .setNegativeButton("Fetch GPS", (d, w) -> fetchVisitGps())
                    .setPositiveButton("Save anyway", (d, w) -> save.run())
                    .show();
        } else save.run();
    }

    private View buildDoctorsPage() {
        LinearLayout body = Ui.vertical(this);
        LinearLayout titleRow = Ui.horizontal(this);
        titleRow.addView(Ui.title(this, "Doctors"), Ui.weight(1));
        Button add = Ui.button(this, "+ Add");
        add.setOnClickListener(v -> openDoctor(0));
        titleRow.addView(add);
        body.addView(titleRow);
        TextView count = Ui.text(this, db.allDoctors(10000).size() + " doctor records · search by doctor or hospital", 13, Ui.MUTED);
        body.addView(count);
        Ui.spacer(body, 10);

        EditText search = Ui.edit(this, "Search doctor, hospital, chemist or address");
        body.addView(search, Ui.matchWrap(this));
        Ui.spacer(body, 8);
        LinearLayout filters = Ui.horizontal(this);
        Button all = Ui.ghost(this, "All");
        Button available = Ui.secondary(this, "Available now");
        Button due = Ui.secondary(this, "Follow-ups due");
        filters.addView(all, Ui.weight(1));
        LinearLayout.LayoutParams fp = Ui.weight(1); fp.setMargins(Ui.dp(this, 6), 0, 0, 0);
        filters.addView(available, fp);
        LinearLayout.LayoutParams fp2 = Ui.weight(1); fp2.setMargins(Ui.dp(this, 6), 0, 0, 0);
        filters.addView(due, fp2);
        body.addView(filters, Ui.matchWrap(this));
        Ui.spacer(body, 8);

        LinearLayout list = Ui.vertical(this);
        body.addView(list, Ui.matchWrap(this));
        Runnable renderAll = () -> renderDoctorCards(list, db.searchDoctors(search.getText().toString(), 200));
        all.setOnClickListener(v -> renderAll.run());
        available.setOnClickListener(v -> renderDoctorCards(list, db.availableDoctors()));
        due.setOnClickListener(v -> renderDoctorCards(list, db.dueDoctors()));
        search.addTextChangedListener(new SimpleWatcher() {
            @Override public void afterTextChanged(Editable s) { renderAll.run(); }
        });
        renderAll.run();
        return pageScroll(body);
    }

    private void renderDoctorCards(LinearLayout list, List<Models.Doctor> doctors) {
        list.removeAllViews();
        for (Models.Doctor doctor : doctors) {
            LinearLayout card = Ui.card(this);
            LinearLayout top = Ui.horizontal(this);
            TextView title = Ui.text(this, doctor.title(), 15, Ui.TEXT);
            title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            top.addView(title, Ui.weight(1));
            if (ScheduleUtils.isAvailableNow(doctor)) top.addView(Ui.pill(this, "AVAILABLE", Ui.SUCCESS));
            else if (doctor.dueFollowUp > 0) top.addView(Ui.pill(this, "FOLLOW-UP", Ui.DANGER));
            card.addView(top);
            String line = doctor.timingText() + "\nChemist: " + (doctor.chemistName.isEmpty() ? "Not linked" : doctor.chemistName);
            if (!doctor.address.isEmpty()) line += "\n" + doctor.address;
            card.addView(Ui.text(this, line, 12, Ui.MUTED));
            LinearLayout actions = Ui.horizontal(this);
            Button log = Ui.button(this, "Log");
            log.setOnClickListener(v -> { selectedDoctor = doctor; switchPage(0); selectDoctor(doctor, true); });
            Button edit = Ui.ghost(this, "Edit");
            edit.setOnClickListener(v -> openDoctor(doctor.id));
            Button route = Ui.secondary(this, "+ Route");
            route.setOnClickListener(v -> { db.addRouteDoctor(Db.todayKey(), doctor.id); Ui.toast(this, "Added to today's route"); });
            actions.addView(log, Ui.weight(1));
            LinearLayout.LayoutParams a2 = Ui.weight(1); a2.setMargins(Ui.dp(this, 6), 0, 0, 0); actions.addView(edit, a2);
            LinearLayout.LayoutParams a3 = Ui.weight(1); a3.setMargins(Ui.dp(this, 6), 0, 0, 0); actions.addView(route, a3);
            card.addView(actions);
            list.addView(card, Ui.matchWrap(this));
            Ui.margin(card, 0, 0, 0, 9);
        }
        if (doctors.isEmpty()) list.addView(Ui.text(this, "No doctors found.", 13, Ui.MUTED));
    }

    private void openDoctor(long doctorId) {
        Intent intent = new Intent(this, DoctorEditActivity.class);
        intent.putExtra("doctor_id", doctorId);
        startActivityForResult(intent, REQ_DOCTOR);
    }

    private View buildTodayPage() {
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.title(this, "Today & cumulative report"));
        TextView subtitle = Ui.text(this, "Calls and report values update automatically as meetings are saved.", 13, Ui.MUTED);
        body.addView(subtitle);
        Ui.spacer(body, 10);

        LinearLayout stats = Ui.horizontal(this);
        stats.addView(statCard("Today", String.valueOf(db.todayCalls())), Ui.weight(1));
        LinearLayout.LayoutParams st2 = Ui.weight(1); st2.setMargins(Ui.dp(this, 8), 0, 0, 0);
        stats.addView(statCard("This month", String.valueOf(db.monthCalls())), st2);
        LinearLayout.LayoutParams st3 = Ui.weight(1); st3.setMargins(Ui.dp(this, 8), 0, 0, 0);
        stats.addView(statCard("Cumulative", String.valueOf(db.cumulativeCalls())), st3);
        body.addView(stats, Ui.matchWrap(this));
        Ui.spacer(body, 10);

        Models.Metrics today = db.metrics(Db.todayKey());
        Models.Metrics cumulative = db.cumulativeMetrics();
        TextView report = Ui.text(this, dailyReport(today, cumulative), 13, Ui.TEXT);
        report.setTypeface(Typeface.MONOSPACE);
        report.setTextIsSelectable(true);
        LinearLayout reportCard = Ui.card(this);
        reportCard.addView(report);
        body.addView(reportCard, Ui.matchWrap(this));
        Ui.spacer(body, 8);
        LinearLayout reportActions = Ui.horizontal(this);
        Button copy = Ui.ghost(this, "Copy report");
        copy.setOnClickListener(v -> {
            android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("MR daily report", dailyReport(db.metrics(Db.todayKey()), db.cumulativeMetrics())));
            Ui.toast(this, "Report copied");
        });
        Button share = Ui.button(this, "WhatsApp / Share");
        share.setOnClickListener(v -> shareText(dailyReport(db.metrics(Db.todayKey()), db.cumulativeMetrics())));
        reportActions.addView(copy, Ui.weight(1));
        LinearLayout.LayoutParams shareP = Ui.weight(1); shareP.setMargins(Ui.dp(this, 8), 0, 0, 0); reportActions.addView(share, shareP);
        body.addView(reportActions, Ui.matchWrap(this));

        body.addView(Ui.section(this, "Daily report items"));
        body.addView(metricRow("Input distributed", "inputs", today.inputs));
        body.addView(metricRow("Basket", "baskets", today.baskets));
        body.addView(metricRow("Towel", "towels", today.towels));
        body.addView(metricRow("Conversations", "conversations", today.conversations));
        body.addView(metricRow("New chemist availability", "availability", today.availability));

        LinearLayout pobCard = Ui.card(this);
        pobCard.addView(Ui.label(this, "Add POB value"));
        LinearLayout pobRow = Ui.horizontal(this);
        EditText pob = Ui.number(this, "₹ amount");
        Button addPob = Ui.button(this, "Add");
        addPob.setOnClickListener(v -> {
            try {
                double value = Double.parseDouble(pob.getText().toString().trim());
                if (value <= 0) throw new NumberFormatException();
                db.addPob(value);
                switchPage(2);
            } catch (Exception e) { pob.setError("Enter valid amount"); }
        });
        pobRow.addView(pob, Ui.weight(1));
        LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT); pp.setMargins(Ui.dp(this, 8), 0, 0, 0); pobRow.addView(addPob, pp);
        pobCard.addView(pobRow);
        body.addView(pobCard, Ui.matchWrap(this));
        Ui.margin(pobCard, 0, 0, 0, 8);

        body.addView(Ui.section(this, "Today's meetings"));
        List<Models.Visit> visits = db.visitsForDay(System.currentTimeMillis());
        for (Models.Visit visit : visits) body.addView(visitCard(visit));
        if (visits.isEmpty()) body.addView(Ui.text(this, "No meeting logged today.", 13, Ui.MUTED));
        return pageScroll(body);
    }

    private LinearLayout statCard(String label, String value) {
        LinearLayout card = Ui.card(this);
        TextView number = Ui.text(this, value, 23, Ui.BRAND_DARK);
        number.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        card.addView(number);
        card.addView(Ui.text(this, label, 11, Ui.MUTED));
        return card;
    }

    private String dailyReport(Models.Metrics today, Models.Metrics cumulative) {
        return "HQ : " + db.getSetting("hq", "Rajkot") +
                "\nName of TM - " + db.getSetting("tm_name", "Olakiya vishal") +
                "\nJoin work with - " + db.getSetting("join_work", "IND") +
                "\nToday Calls/Cum - " + db.todayCalls() + "/" + db.cumulativeCalls() +
                "\nInput Distributed -" + today.inputs + "/" + cumulative.inputs +
                "\nBasket Today/Cum -" + today.baskets + "/" + cumulative.baskets +
                "\nTowel Today/Cum -" + today.towels + "/" + cumulative.towels +
                "\nNo of conversation Today/Cum: " + today.conversations + "/" + cumulative.conversations +
                "\nNo new chemist product availability done Today/Cum:" + today.availability + "/" + cumulative.availability +
                "\nTotal POB value Today/Cum:" + money(today.pob) + "/" + money(cumulative.pob);
    }

    private String money(double value) {
        if (Math.rint(value) == value) return String.valueOf((long) value);
        return String.format(Locale.US, "%.2f", value);
    }

    private LinearLayout metricRow(String label, String field, int value) {
        LinearLayout card = Ui.card(this);
        LinearLayout row = Ui.horizontal(this);
        row.addView(Ui.text(this, label, 14, Ui.TEXT), Ui.weight(1));
        Button minus = Ui.ghost(this, "−");
        TextView count = Ui.text(this, String.valueOf(value), 17, Ui.TEXT);
        count.setGravity(Gravity.CENTER);
        count.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        Button plus = Ui.secondary(this, "+");
        minus.setOnClickListener(v -> { db.adjustMetric(field, -1); switchPage(2); });
        plus.setOnClickListener(v -> { db.adjustMetric(field, 1); switchPage(2); });
        row.addView(minus, new LinearLayout.LayoutParams(Ui.dp(this, 48), Ui.dp(this, 44)));
        row.addView(count, new LinearLayout.LayoutParams(Ui.dp(this, 48), ViewGroup.LayoutParams.WRAP_CONTENT));
        row.addView(plus, new LinearLayout.LayoutParams(Ui.dp(this, 48), Ui.dp(this, 44)));
        card.addView(row);
        Ui.margin(card, 0, 0, 0, 8);
        return card;
    }

    private LinearLayout visitCard(Models.Visit visit) {
        LinearLayout card = Ui.card(this);
        TextView title = Ui.text(this, visit.doctorTitle, 14, Ui.TEXT);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        card.addView(title);
        String details = Models.formatDateTime(visit.visitedAt) + (visit.chemistName.isEmpty() ? "" : " · " + visit.chemistName);
        card.addView(Ui.text(this, details, 12, Ui.MUTED));
        if (!visit.productSummary.isEmpty()) card.addView(Ui.text(this, visit.productSummary, 12, Ui.TEXT));
        if (!visit.notes.isEmpty()) card.addView(Ui.text(this, visit.notes, 12, Ui.MUTED));
        Ui.margin(card, 0, 0, 0, 8);
        return card;
    }

    private void shareText(String text) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        startActivity(Intent.createChooser(send, "Share daily report"));
    }

    private View buildRoutePage() {
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.title(this, "Today's route"));
        body.addView(Ui.text(this, "Add doctors in visiting order. Saved GPS is used to open a multi-stop route.", 13, Ui.MUTED));
        Ui.spacer(body, 10);

        EditText search = Ui.edit(this, "Search doctor or hospital to add");
        body.addView(search, Ui.matchWrap(this));
        LinearLayout results = Ui.vertical(this);
        body.addView(results, Ui.matchWrap(this));
        search.addTextChangedListener(new SimpleWatcher() {
            @Override public void afterTextChanged(Editable s) {
                renderDoctorSearchResults(results, s.toString(), doctor -> {
                    if (db.routeDoctors(Db.todayKey()).size() >= 8) {
                        Ui.toast(MainActivity.this, "Maximum 8 doctors per route");
                        return;
                    }
                    db.addRouteDoctor(Db.todayKey(), doctor.id);
                    search.setText("");
                    switchPage(3);
                }, 10);
            }
        });

        List<Models.Doctor> route = db.routeDoctors(Db.todayKey());
        TextView routeCount = Ui.section(this, "Planned doctors · " + route.size());
        body.addView(routeCount);
        int number = 1;
        for (Models.Doctor doctor : route) {
            LinearLayout card = Ui.card(this);
            LinearLayout top = Ui.horizontal(this);
            TextView index = Ui.pill(this, String.valueOf(number++), Ui.BRAND);
            top.addView(index);
            TextView title = Ui.text(this, doctor.title(), 14, Ui.TEXT);
            title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            LinearLayout.LayoutParams tp = Ui.weight(1); tp.setMargins(Ui.dp(this, 8), 0, 0, 0); top.addView(title, tp);
            card.addView(top);
            String gps = (doctor.latitude != 0 || doctor.longitude != 0) ? String.format(Locale.US, "GPS %.5f, %.5f", doctor.latitude, doctor.longitude) : "GPS missing — log once or edit doctor";
            card.addView(Ui.text(this, doctor.timingText() + "\n" + gps, 12, Ui.MUTED));
            LinearLayout actions = Ui.horizontal(this);
            Button log = Ui.button(this, "Log");
            log.setOnClickListener(v -> { selectedDoctor = doctor; switchPage(0); selectDoctor(doctor, true); });
            Button remove = Ui.danger(this, "Remove");
            remove.setOnClickListener(v -> { db.removeRouteDoctor(Db.todayKey(), doctor.id); switchPage(3); });
            actions.addView(log, Ui.weight(1));
            LinearLayout.LayoutParams rp = Ui.weight(1); rp.setMargins(Ui.dp(this, 8), 0, 0, 0); actions.addView(remove, rp);
            card.addView(actions);
            body.addView(card, Ui.matchWrap(this));
            Ui.margin(card, 0, 0, 0, 8);
        }

        Button maps = Ui.button(this, "Open route in Maps");
        maps.setOnClickListener(v -> openRoute(route));
        body.addView(maps, Ui.matchWrap(this));
        Ui.spacer(body, 8);
        Button settings = Ui.ghost(this, "Open Android location settings");
        settings.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)));
        body.addView(settings, Ui.matchWrap(this));
        return pageScroll(body);
    }

    private void openRoute(List<Models.Doctor> route) {
        List<Models.Doctor> located = new ArrayList<>();
        for (Models.Doctor doctor : route) if (doctor.latitude != 0 || doctor.longitude != 0) located.add(doctor);
        if (located.isEmpty()) {
            Ui.toast(this, "No saved doctor GPS in today's route");
            return;
        }
        try {
            Models.Doctor destination = located.get(located.size() - 1);
            StringBuilder uri = new StringBuilder("https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=")
                    .append(destination.latitude).append(',').append(destination.longitude);
            if (located.size() > 1) {
                uri.append("&waypoints=");
                for (int i = 0; i < located.size() - 1; i++) {
                    if (i > 0) uri.append("%7C");
                    uri.append(located.get(i).latitude).append(',').append(located.get(i).longitude);
                }
            }
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString())));
        } catch (Exception e) {
            Ui.toast(this, "Maps app or browser not available");
        }
    }

    private View buildMorePage() {
        LinearLayout body = Ui.vertical(this);
        body.addView(Ui.title(this, "More & settings"));
        body.addView(Ui.text(this, "All master data and visits stay in this app's private offline phone database.", 13, Ui.MUTED));

        body.addView(Ui.section(this, "Daily report profile"));
        LinearLayout profile = Ui.card(this);
        EditText hq = Ui.edit(this, "HQ"); hq.setText(db.getSetting("hq", "Rajkot"));
        EditText tm = Ui.edit(this, "TM name"); tm.setText(db.getSetting("tm_name", "Olakiya vishal"));
        EditText join = Ui.edit(this, "Join work with"); join.setText(db.getSetting("join_work", "IND"));
        profile.addView(hq, Ui.matchWrap(this)); Ui.spacer(profile, 8);
        profile.addView(tm, Ui.matchWrap(this)); Ui.spacer(profile, 8);
        profile.addView(join, Ui.matchWrap(this)); Ui.spacer(profile, 8);
        Button saveProfile = Ui.button(this, "Save profile");
        saveProfile.setOnClickListener(v -> {
            db.setSetting("hq", hq.getText().toString().trim());
            db.setSetting("tm_name", tm.getText().toString().trim());
            db.setSetting("join_work", join.getText().toString().trim());
            Ui.toast(this, "Profile saved");
        });
        profile.addView(saveProfile, Ui.matchWrap(this));
        body.addView(profile, Ui.matchWrap(this));

        body.addView(Ui.section(this, "Doctors & Excel"));
        LinearLayout masterActions = Ui.horizontal(this);
        Button addDoctor = Ui.button(this, "+ Doctor"); addDoctor.setOnClickListener(v -> openDoctor(0));
        Button importExcel = Ui.secondary(this, "Import Excel / CSV"); importExcel.setOnClickListener(v -> chooseImport());
        masterActions.addView(addDoctor, Ui.weight(1));
        LinearLayout.LayoutParams imp = Ui.weight(1); imp.setMargins(Ui.dp(this, 8), 0, 0, 0); masterActions.addView(importExcel, imp);
        body.addView(masterActions, Ui.matchWrap(this));
        TextView importHelp = Ui.text(this, "Import merges duplicates using Doctor Name + Hospital. Supported: .xlsx, .csv and old MR Daily Auto .json backup.", 12, Ui.MUTED);
        importHelp.setPadding(0, Ui.dp(this, 7), 0, 0);
        body.addView(importHelp);

        body.addView(Ui.section(this, "Chemists"));
        LinearLayout chemistBox = Ui.card(this);
        LinearLayout chemistTop = Ui.horizontal(this);
        EditText chemistSearch = Ui.edit(this, "Search chemist");
        Button addChemist = Ui.button(this, "+ Add"); addChemist.setOnClickListener(v -> openChemist(0));
        chemistTop.addView(chemistSearch, Ui.weight(1));
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT); cp.setMargins(Ui.dp(this, 8), 0, 0, 0); chemistTop.addView(addChemist, cp);
        chemistBox.addView(chemistTop);
        LinearLayout chemistResults = Ui.vertical(this); chemistBox.addView(chemistResults);
        Runnable renderChemists = () -> {
            chemistResults.removeAllViews();
            for (Models.Chemist c : db.searchChemists(chemistSearch.getText().toString(), 20)) {
                LinearLayout row = Ui.horizontal(this);
                TextView text = Ui.text(this, c.name + (c.address.isEmpty() ? "" : "\n" + c.address), 13, Ui.TEXT);
                row.addView(text, Ui.weight(1));
                Button edit = Ui.ghost(this, "Edit"); edit.setOnClickListener(v -> openChemist(c.id)); row.addView(edit);
                chemistResults.addView(row, Ui.matchWrap(this));
                Ui.margin(row, 0, 7, 0, 0);
            }
        };
        chemistSearch.addTextChangedListener(new SimpleWatcher() { @Override public void afterTextChanged(Editable s) { renderChemists.run(); } });
        renderChemists.run();
        body.addView(chemistBox, Ui.matchWrap(this));

        body.addView(Ui.section(this, "Products"));
        LinearLayout productBox = Ui.card(this);
        LinearLayout addProductRow = Ui.horizontal(this);
        EditText productName = Ui.edit(this, "New product name");
        Button addProduct = Ui.button(this, "Add");
        addProduct.setOnClickListener(v -> {
            String n = productName.getText().toString().trim();
            if (n.isEmpty()) { productName.setError("Enter product name"); return; }
            db.upsertProduct(n); productName.setText(""); switchPage(4);
        });
        addProductRow.addView(productName, Ui.weight(1));
        LinearLayout.LayoutParams ap = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT); ap.setMargins(Ui.dp(this, 8), 0, 0, 0); addProductRow.addView(addProduct, ap);
        productBox.addView(addProductRow);
        for (Models.Product product : db.products(false)) {
            CheckBox active = new CheckBox(this);
            active.setText(product.name);
            active.setTextColor(Ui.TEXT);
            active.setChecked(product.active);
            active.setButtonTintList(android.content.res.ColorStateList.valueOf(Ui.BRAND));
            active.setOnCheckedChangeListener((button, checked) -> db.setProductActive(product.id, checked));
            productBox.addView(active, Ui.matchWrap(this));
        }
        body.addView(productBox, Ui.matchWrap(this));

        body.addView(Ui.section(this, "Backup & restore"));
        LinearLayout backup = Ui.card(this);
        backup.addView(Ui.text(this, "Choose Phone storage or Google Drive in Android's file picker. Backups include doctors, chemists, visits, GPS, product status, timings and settings.", 12, Ui.MUTED));
        Ui.spacer(backup, 8);
        LinearLayout backupActions = Ui.horizontal(this);
        Button export = Ui.button(this, "Create backup"); export.setOnClickListener(v -> BackupUtils.chooseExport(this));
        Button restore = Ui.danger(this, "Restore backup"); restore.setOnClickListener(v -> BackupUtils.chooseRestore(this));
        backupActions.addView(export, Ui.weight(1));
        LinearLayout.LayoutParams br = Ui.weight(1); br.setMargins(Ui.dp(this, 8), 0, 0, 0); backupActions.addView(restore, br);
        backup.addView(backupActions);
        body.addView(backup, Ui.matchWrap(this));

        body.addView(Ui.section(this, "App lock"));
        LinearLayout security = Ui.card(this);
        TextView lockStatus = Ui.text(this, AppLock.enabled(db) ? "PIN lock is ON" : "PIN lock is OFF", 14, AppLock.enabled(db) ? Ui.SUCCESS : Ui.MUTED);
        security.addView(lockStatus);
        Ui.spacer(security, 8);
        LinearLayout securityActions = Ui.horizontal(this);
        Button setPin = Ui.button(this, AppLock.enabled(db) ? "Change PIN" : "Set PIN"); setPin.setOnClickListener(v -> showSetPin());
        Button disablePin = Ui.danger(this, "Disable"); disablePin.setEnabled(AppLock.enabled(db)); disablePin.setOnClickListener(v -> confirmDisablePin());
        securityActions.addView(setPin, Ui.weight(1));
        LinearLayout.LayoutParams ds = Ui.weight(1); ds.setMargins(Ui.dp(this, 8), 0, 0, 0); securityActions.addView(disablePin, ds);
        security.addView(securityActions);
        CheckBox bio = new CheckBox(this);
        bio.setText("Use fingerprint / face after PIN is set");
        bio.setTextColor(Ui.TEXT);
        bio.setChecked(AppLock.biometricEnabled(db));
        bio.setEnabled(AppLock.enabled(db));
        bio.setOnCheckedChangeListener((button, checked) -> db.setSetting("biometric_enabled", checked ? "1" : "0"));
        security.addView(bio);
        body.addView(security, Ui.matchWrap(this));

        body.addView(Ui.section(this, "App information"));
        LinearLayout info = Ui.card(this);
        info.addView(Ui.text(this, "MR FieldBook Native v8\nOffline SQLite storage · No Termux required after APK installation\nStarter data: " + db.allDoctors(10000).size() + " doctors, " + db.searchChemists("", 10000).size() + " chemists, " + db.products(false).size() + " products", 13, Ui.MUTED));
        body.addView(info, Ui.matchWrap(this));
        return pageScroll(body);
    }

    private void chooseImport() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "application/csv", "application/json"});
        startActivityForResult(intent, REQ_IMPORT);
    }

    private void openChemist(long id) {
        Intent intent = new Intent(this, ChemistEditActivity.class);
        intent.putExtra("chemist_id", id);
        startActivityForResult(intent, REQ_CHEMIST);
    }

    private void showSetPin() {
        EditText pin = Ui.edit(this, "4–8 digit PIN");
        pin.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        new AlertDialog.Builder(this)
                .setTitle(AppLock.enabled(db) ? "Change app PIN" : "Set app PIN")
                .setMessage("Use a PIN you can remember. It cannot be recovered without restoring an older backup.")
                .setView(pin)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (d, w) -> {
                    try { AppLock.setPin(db, pin.getText().toString()); Ui.toast(this, "PIN lock enabled"); switchPage(4); }
                    catch (Exception e) { Ui.toast(this, e.getMessage()); }
                }).show();
    }

    private void confirmDisablePin() {
        EditText pin = Ui.edit(this, "Current PIN");
        pin.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        new AlertDialog.Builder(this)
                .setTitle("Disable app lock?")
                .setView(pin)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Disable", (d, w) -> {
                    if (AppLock.verify(db, pin.getText().toString())) { AppLock.clear(db); Ui.toast(this, "App lock disabled"); switchPage(4); }
                    else Ui.toast(this, "Wrong PIN");
                }).show();
    }

    private void requestNotificationsIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7301);
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK) return;
        if (requestCode == REQ_DOCTOR) {
            long id = data == null ? 0 : data.getLongExtra("doctor_id", 0);
            if (id > 0) selectedDoctor = db.getDoctor(id);
            switchPage(currentPage == 0 ? 0 : 1);
        } else if (requestCode == REQ_CHEMIST) {
            switchPage(4);
        } else if (requestCode == REQ_IMPORT && data != null && data.getData() != null) {
            try {
                String name = FileUtils.displayName(this, data.getData()).toLowerCase(Locale.ROOT);
                String message;
                if (name.endsWith(".json")) message = LegacyJsonImporter.importUri(this, db, data.getData()).message();
                else message = ExcelImporter.importUri(this, db, data.getData()).message();
                new AlertDialog.Builder(this).setTitle("Import complete").setMessage(message).setPositiveButton("OK", (d, w) -> switchPage(1)).show();
            } catch (Exception e) {
                new AlertDialog.Builder(this).setTitle("Import failed").setMessage(e.getMessage()).setPositiveButton("OK", null).show();
            }
        } else if (requestCode == BackupUtils.REQ_EXPORT && data != null && data.getData() != null) {
            try { BackupUtils.exportDb(this, db, data.getData()); Ui.toast(this, "Backup created"); }
            catch (Exception e) { showError("Backup failed", e); }
        } else if (requestCode == BackupUtils.REQ_RESTORE && data != null && data.getData() != null) {
            new AlertDialog.Builder(this)
                    .setTitle("Replace all current data?")
                    .setMessage("Restore will replace doctors, visits, GPS, timings and settings with the selected backup.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Restore", (d, w) -> {
                        try {
                            BackupUtils.restoreDb(this, db, data.getData());
                            db = new Db(this);
                            ReminderScheduler.rescheduleAll(this);
                            Ui.toast(this, "Backup restored");
                            buildShell();
                        } catch (Exception e) { showError("Restore failed", e); }
                    }).show();
        }
    }

    private void showError(String title, Exception e) {
        new AlertDialog.Builder(this).setTitle(title).setMessage(e.getMessage() == null ? e.toString() : e.getMessage()).setPositiveButton("OK", null).show();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LocationHelper.REQUEST_LOCATION && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) fetchVisitGps();
    }

    @Override protected void onResume() {
        super.onResume();
        if (pageHost != null && currentPage >= 0 && currentPage < 5) {
            // Child edit activities may have changed master data.
        }
    }

    private interface DoctorAction { void run(Models.Doctor doctor); }

    private abstract static class SimpleWatcher implements TextWatcher {
        @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
        @Override public void onTextChanged(CharSequence s, int start, int before, int count) { }
    }
}
