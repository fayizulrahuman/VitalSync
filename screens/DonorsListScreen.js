import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MedicineContext } from '../context/MedicineContext';
import { backupDataToCloud } from '../CloudSync';
import { auth } from '../firebaseConfig';

// --- YOUR COMPLETE DONOR DIRECTORY ---
const STATIC_DONORS = [
  // BDK COORDINATORS
  { id: 'b1', name: 'VINOD (ALL KERALA)', phone: '9633027457', bg: 'ANY', initial: 'V' },
  { id: 'b2', name: 'NOUSHAD (ALL KERALA)', phone: '9846299155', bg: 'ANY', initial: 'N' },
  { id: 'b3', name: 'ANEESH (TRIVANDRUM)', phone: '8589040494', bg: 'ANY', initial: 'A' },
  { id: 'b4', name: 'AMAR (TRIVANDRUM)', phone: '7736726918', bg: 'ANY', initial: 'A' },
  { id: 'b5', name: 'JEEVAN (TRIVANDRUM)', phone: '9020711993', bg: 'ANY', initial: 'J' },
  { id: 'b6', name: 'SANDEEP (PATHANAMTHITTA)', phone: '9496469181', bg: 'ANY', initial: 'S' },
  { id: 'b7', name: 'SUJU (PATHANAMTHITTA)', phone: '9961046082', bg: 'ANY', initial: 'S' },
  { id: 'b8', name: 'SARATH (ALAPPUZHA)', phone: '9061921679', bg: 'ANY', initial: 'S' },
  { id: 'b9', name: 'ANAND (ALAPPUZHA)', phone: '9895710502', bg: 'ANY', initial: 'A' },
  { id: 'b10', name: 'ABDUL RAFI (IDUKKI)', phone: '9526559990', bg: 'ANY', initial: 'A' },
  { id: 'b11', name: 'NISHAD (IDUKKI)', phone: '9400287995', bg: 'ANY', initial: 'N' },
  { id: 'b12', name: 'SWADHIN (ERNAKULAM)', phone: '7356658846', bg: 'ANY', initial: 'S' },
  { id: 'b13', name: 'ANEESH (ERNAKULAM)', phone: '8113063030', bg: 'ANY', initial: 'A' },
  { id: 'b14', name: 'SREEKANTH (THRISSUR)', phone: '9656965965', bg: 'ANY', initial: 'S' },
  { id: 'b15', name: 'STEPHIN (THRISSUR)', phone: '8907279096', bg: 'ANY', initial: 'S' },
  { id: 'b16', name: 'BINOY (THRISSUR)', phone: '9446020888', bg: 'ANY', initial: 'B' },
  { id: 'b17', name: 'VINU (PALAKKAD)', phone: '9539166565', bg: 'ANY', initial: 'V' },
  { id: 'b18', name: 'SAJAY (MALAPPURAM)', phone: '9809371517', bg: 'ANY', initial: 'S' },
  { id: 'b19', name: 'LIJESH (MALAPPURAM)', phone: '8089676943', bg: 'ANY', initial: 'L' },
  { id: 'b20', name: 'BIJOY (KOZHIKODE)', phone: '8547000807', bg: 'ANY', initial: 'B' },
  { id: 'b21', name: 'SAJI (KANNUR)', phone: '9895643445', bg: 'ANY', initial: 'S' },
  { id: 'b22', name: 'MSK (KANNUR)', phone: '9847772786', bg: 'ANY', initial: 'M' },
  { id: 'b23', name: 'SANAL (KASARAGOD)', phone: '9400730009', bg: 'ANY', initial: 'S' },
  { id: 'b24', name: 'DINOOP (KASARAGOD)', phone: '9656953417', bg: 'ANY', initial: 'D' },
  { id: 'b25', name: 'RANJITH (WAYANAD)', phone: '9447263167', bg: 'ANY', initial: 'R' },

  // INDIVIDUAL DONORS
  { id: 'd0', name: 'SINU', phone: '7736214775', bg: 'B+', initial: 'S' },
  { id: 'd1', name: 'GOKUL', phone: '8129827147', bg: 'O+', initial: 'G' },
  { id: 'd2', name: 'VAISAKH', phone: '9633199929', bg: 'B+', initial: 'V' },
  { id: 'd3', name: 'KANNAN S', phone: '9061114508', bg: 'O+', initial: 'K' },
  { id: 'd4', name: 'VIKAS', phone: '9995864375', bg: 'A+', initial: 'V' },
  { id: 'd5', name: 'JOSEPH', phone: '9633093629', bg: 'A+', initial: 'J' },
  { id: 'd6', name: 'ASIF', phone: '7736884379', bg: 'B+', initial: 'A' },
  { id: 'd7', name: 'MINSHAD', phone: '8129641358', bg: 'AB-', initial: 'M' },
  { id: 'd8', name: 'ABHISHEK', phone: '9539850962', bg: 'A+', initial: 'A' },
  { id: 'd9', name: 'ASWIN S', phone: '8129890204', bg: 'O+', initial: 'A' },
  { id: 'd10', name: 'MD GESUDHARAZ', phone: '8464946413', bg: 'A+', initial: 'M' },
  { id: 'd11', name: 'MANI', phone: '7401535415', bg: 'O+', initial: 'M' },
  { id: 'd12', name: 'SRIRAM', phone: '8056051072', bg: 'B+', initial: 'S' },
  { id: 'd13', name: 'RAMESH', phone: '9884727286', bg: 'B+', initial: 'R' },
  { id: 'd14', name: 'SURESH', phone: '8148916988', bg: 'B+', initial: 'S' },
  { id: 'd15', name: 'MURALI', phone: '7299399392', bg: 'A+', initial: 'M' },
  { id: 'd16', name: 'PRABHU', phone: '9884641396', bg: 'O+', initial: 'P' },
  { id: 'd17', name: 'VIJAY', phone: '9790954376', bg: 'AB-', initial: 'V' },
  { id: 'd18', name: 'JAI', phone: '99623610622', bg: 'B-', initial: 'J' },
  { id: 'd19', name: 'RAJA', phone: '9789865312', bg: 'A1+', initial: 'R' },
  { id: 'd20', name: 'MANIKANDAN', phone: '9566420317', bg: 'A+', initial: 'M' },
  { id: 'd21', name: 'SENTHILKUMAR', phone: '9962688252', bg: 'B+', initial: 'S' },
  { id: 'd22', name: 'PRAVEEN KUMAR', phone: '9094314313', bg: 'B+', initial: 'P' },
  { id: 'd23', name: 'MOHANRAJ', phone: '9444464789', bg: 'B+', initial: 'M' },
  { id: 'd24', name: 'MANIKANDAN', phone: '9791097653', bg: 'O+', initial: 'M' },
  { id: 'd25', name: 'C.PRATHAP', phone: '9940521093', bg: 'O+', initial: 'C' },
  { id: 'd26', name: 'ISAIANAND', phone: '7845548466', bg: 'O+', initial: 'I' },
  { id: 'd27', name: 'S THILAK', phone: '861810723', bg: 'O+', initial: 'S' },
  { id: 'd28', name: 'ANBUMANI', phone: '9566001676', bg: 'O+', initial: 'A' },
  { id: 'd29', name: 'SYED', phone: '9551457239', bg: 'A+', initial: 'S' },
  { id: 'd30', name: 'M.JAGADEESANVB', phone: '7845662500', bg: 'A+', initial: 'M' },
  { id: 'd31', name: 'KARTHIKEYAN', phone: '9884400371', bg: 'O+', initial: 'K' },
  { id: 'd32', name: 'DANIEL', phone: '9003148805', bg: 'B+', initial: 'D' },
  { id: 'd33', name: 'SRIDHAR', phone: '9500119761', bg: 'O+', initial: 'S' },
  { id: 'd34', name: 'V.MOHAN', phone: '9940639557', bg: 'O+', initial: 'V' },
  { id: 'd35', name: 'JAWAHAR', phone: '9600162581', bg: 'B+', initial: 'J' },
  { id: 'd36', name: 'V.KARTHICK', phone: '9578828854', bg: 'A+', initial: 'V' },
  { id: 'd37', name: 'KALIDASS', phone: '9943948951', bg: 'A+', initial: 'K' },
  { id: 'd38', name: 'ABBAS', phone: '9551414146', bg: 'A1-', initial: 'A' },
  { id: 'd39', name: 'M.KARUKKUVEL RAJ', phone: '9087425095', bg: 'B+', initial: 'M' },
  { id: 'd40', name: 'NARENDRAN', phone: '9500148984', bg: 'B+', initial: 'N' },
  { id: 'd41', name: 'EDWIN', phone: '9791150119', bg: 'O-', initial: 'E' },
  { id: 'd42', name: 'SELVAGANESH2', phone: '9940187708', bg: 'A+', initial: 'S' },
  { id: 'd43', name: 'SIDDIQ', phone: '9094666918', bg: 'O+', initial: 'S' },
  { id: 'd44', name: 'A.INBA KUMAR', phone: '9840301747', bg: 'O+', initial: 'A' },
  { id: 'd45', name: 'VIGNESH', phone: '9884556995', bg: 'B+', initial: 'V' },
  { id: 'd46', name: 'VOGNESHGIRI', phone: '9043677660', bg: 'B+', initial: 'V' },
  { id: 'd47', name: 'ANBARASAN', phone: '9840862846', bg: 'O+', initial: 'A' },
  { id: 'd48', name: 'M.VIMAL KUMAR', phone: '9677279760', bg: 'O+', initial: 'M' },
  { id: 'd49', name: 'JEEVA', phone: '8056292339', bg: 'AB-', initial: 'J' },
  { id: 'd50', name: 'SARATH', phone: '9551113240', bg: 'A+', initial: 'S' },
  { id: 'd51', name: 'VAZIR', phone: '8754034986', bg: 'O+', initial: 'V' },
  { id: 'd52', name: 'DINESH', phone: '8122288878', bg: 'A1+', initial: 'D' },
  { id: 'd53', name: 'BALAKRISH', phone: '9047904837', bg: 'O+', initial: 'B' },
  { id: 'd54', name: 'MADHAN', phone: '9940391891', bg: 'AB+', initial: 'M' },
  { id: 'd55', name: 'P.P.PRADHEESH', phone: '8903612888', bg: 'O+', initial: 'P' },
  { id: 'd56', name: 'SHAKKUR', phone: '971552177084', bg: 'B+', initial: 'S' },
  { id: 'd57', name: 'VENKAT', phone: '9666661705', bg: 'B-', initial: 'V' },
  { id: 'd58', name: 'ROSHAN', phone: '9100954327', bg: 'A+', initial: 'R' },
  { id: 'd59', name: 'RAJALINGAM', phone: '9626696882', bg: 'B+', initial: 'R' },
  { id: 'd60', name: 'SUNDAR', phone: '9941418736', bg: 'O+', initial: 'S' },
  { id: 'd61', name: 'YUVARAJ', phone: '8124291412', bg: 'AB+', initial: 'Y' },
  { id: 'd62', name: 'JAGIR', phone: '9042670928', bg: 'B+', initial: 'J' },
  { id: 'd63', name: 'SURESH KUMAR', phone: '9840939939', bg: 'O+', initial: 'S' },
  { id: 'd64', name: 'ARAVIND', phone: '9176980878', bg: 'O+', initial: 'A' },
  { id: 'd65', name: 'C.RAJKUMAR', phone: '9790844373', bg: 'B+', initial: 'C' },
  { id: 'd66', name: 'ASHOK KUMAR', phone: '9791142469', bg: 'B+', initial: 'A' },
  { id: 'd67', name: 'RIYAZ', phone: '9946461098', bg: 'A+', initial: 'R' },
  { id: 'd68', name: 'SHIFILI', phone: '8592069169', bg: 'O-', initial: 'S' },
  { id: 'd69', name: 'SAVAD', phone: '9645755153', bg: 'O-', initial: 'S' },
  { id: 'd70', name: 'SHAHEER BABU', phone: '9072057794', bg: 'O+', initial: 'S' },
  { id: 'd71', name: 'MUJTHAB', phone: '9746528542', bg: 'A+', initial: 'M' },
  { id: 'd72', name: 'SALAHUDHEEN', phone: '9946166176', bg: 'B+', initial: 'S' },
  { id: 'd73', name: 'RAHEEM', phone: '9895250966', bg: 'O+', initial: 'R' },
  { id: 'd74', name: 'ANAS MALIK', phone: '9744429691', bg: 'O-', initial: 'A' },
  { id: 'd75', name: 'SUHAIB', phone: '8943073955', bg: 'A+', initial: 'S' },
  { id: 'd76', name: 'ALI AKBAR', phone: '9961254697', bg: 'B+', initial: 'A' },
  { id: 'd77', name: 'SAKEER', phone: '9745860818', bg: 'A+', initial: 'S' },
  { id: 'd78', name: 'NOORU', phone: '9633531455', bg: 'A+', initial: 'N' },
  { id: 'd79', name: 'JAMSHEER', phone: '9656691847', bg: 'A+', initial: 'J' },
  { id: 'd80', name: 'RIZWAN RIZU', phone: '9633713598', bg: 'O-', initial: 'R' },
  { id: 'd81', name: 'ARJUN', phone: '9847134123', bg: 'B+', initial: 'A' },
  { id: 'd82', name: 'VSG', phone: '9995603700', bg: 'AB+', initial: 'V' },
  { id: 'd83', name: 'JACOB', phone: '9048377976', bg: 'B+', initial: 'J' },
  { id: 'd84', name: 'FELIX', phone: '8086245939', bg: 'O+', initial: 'F' },
  { id: 'd85', name: 'DEEPU', phone: '9645871886', bg: 'A+', initial: 'D' },
  { id: 'd86', name: 'ROCKY', phone: '8281933648', bg: 'B+', initial: 'R' },
  { id: 'd87', name: 'ALBERT', phone: '8281206546', bg: 'B+', initial: 'A' },
  { id: 'd88', name: 'JINU', phone: '9846487678', bg: 'O+', initial: 'J' },
  { id: 'd89', name: 'SIBIN', phone: '9446768899', bg: 'B+', initial: 'S' },
  { id: 'd90', name: 'HARITH', phone: '9747400626', bg: 'O+', initial: 'H' },
  { id: 'd91', name: 'KURIAKOSE', phone: '9496942450', bg: 'B+', initial: 'K' },
  { id: 'd92', name: 'TIVIN', phone: '8129591035', bg: 'O+', initial: 'T' },
  { id: 'd93', name: 'CHERIN', phone: '9400617023', bg: 'B+', initial: 'C' },
  { id: 'd94', name: 'SAJU', phone: '9567033982', bg: 'A+', initial: 'S' },
  { id: 'd95', name: 'PRINCE', phone: '9400990718', bg: 'B+', initial: 'P' },
  { id: 'd96', name: 'SACHIN', phone: '9400316231', bg: 'B+', initial: 'S' },
  { id: 'd97', name: 'JOSEPH', phone: '9995728167', bg: 'O+', initial: 'J' },
  { id: 'd98', name: 'MATHEW', phone: '9746148776', bg: 'O+', initial: 'M' },
  { id: 'd99', name: 'BECHAN', phone: '8129035002', bg: 'O+', initial: 'B' },
  { id: 'd100', name: 'JOM', phone: '9747419567', bg: 'O+', initial: 'J' },
  { id: 'd101', name: 'MELBIN', phone: '8089761500', bg: 'B+', initial: 'M' },
  { id: 'd102', name: 'SAVIN', phone: '9744844417', bg: 'A+', initial: 'S' },
  { id: 'd103', name: 'SACHU', phone: '9497820946', bg: 'B-', initial: 'S' },
  { id: 'd104', name: 'JITHIN', phone: '9497392434', bg: 'A+', initial: 'J' },
  { id: 'd105', name: 'ARUN', phone: '9497326436', bg: 'AB+', initial: 'A' },
  { id: 'd106', name: 'MELVIN', phone: '8891196900', bg: 'A+', initial: 'M' },
  { id: 'd107', name: 'AKHIL V SUNNY', phone: '7834902916', bg: 'A+', initial: 'A' },
  { id: 'd108', name: 'VIJAY. V', phone: '9496039698', bg: 'AB+', initial: 'V' },
  { id: 'd109', name: 'SWAROOP', phone: '9633142497', bg: 'O+', initial: 'S' },
  { id: 'd110', name: 'SHAHIR', phone: '9526257742', bg: 'B+', initial: 'S' },
  { id: 'd111', name: 'HARI', phone: '7558875507', bg: 'A+', initial: 'H' },
  { id: 'd112', name: 'SHAJU', phone: '9747905889', bg: 'A+', initial: 'S' },
  { id: 'd113', name: 'GOPU', phone: '9747184825', bg: 'B+', initial: 'G' },
  { id: 'd114', name: 'NIKHIL T R', phone: '9605233539', bg: 'O+', initial: 'N' },
  { id: 'd115', name: 'AKHILESH', phone: '8891343589', bg: 'B+', initial: 'A' },
  { id: 'd116', name: 'AL SHUWAIQ', phone: '8606690808', bg: 'O-', initial: 'A' },
  { id: 'd117', name: 'BILAL', phone: '9656514999', bg: 'B+', initial: 'B' },
  { id: 'd118', name: 'ABHIJITH', phone: '9961347861', bg: 'A+', initial: 'A' },
  { id: 'd119', name: 'ACHU', phone: '9526058701', bg: 'A+', initial: 'A' },
  { id: 'd120', name: 'JITHU', phone: '8592814350', bg: 'O+', initial: 'J' },
  { id: 'd121', name: 'AJAY', phone: '9020758895', bg: 'A-', initial: 'A' },
  { id: 'd122', name: 'SREEKALESH', phone: '9544877475', bg: 'O+', initial: 'S' },
  { id: 'd123', name: 'RAHUL', phone: '9745255251', bg: 'O+', initial: 'R' },
  { id: 'd124', name: 'NIDHEESH PILLAI', phone: '8547957312', bg: 'O+', initial: 'N' },
  { id: 'd125', name: 'SACHIN', phone: '8086517545', bg: 'B-', initial: 'S' },
  { id: 'd126', name: 'BINOD', phone: '9846647117', bg: 'O+', initial: 'B' },
  { id: 'd127', name: 'ANWIN MOHAN', phone: '9387885978', bg: 'A+', initial: 'A' },
  { id: 'd128', name: 'SARIN', phone: '9539516207', bg: 'B+', initial: 'S' },
  { id: 'd129', name: 'SIRAJ KUMBIDI', phone: '9544633325', bg: 'O+', initial: 'S' },
  { id: 'd130', name: 'ROBIN', phone: '8113965795', bg: 'B+', initial: 'R' },
  { id: 'd131', name: 'RAHUL RAJ', phone: '9995756926', bg: 'A+', initial: 'R' },
  { id: 'd132', name: 'SANU JACOB', phone: '8281805938', bg: 'B+', initial: 'S' },
  { id: 'd133', name: 'RAHUL G NAIR', phone: '9656136832', bg: 'B+', initial: 'R' },
  { id: 'd134', name: 'ABDUL HAKKIM S', phone: '9961721665', bg: 'A+', initial: 'A' },
  { id: 'd135', name: 'MOHAMMED SAALIM', phone: '8086455956', bg: 'AB+', initial: 'M' },
  { id: 'd136', name: 'RAMSHAD', phone: '8157009954', bg: 'A+', initial: 'R' },
  { id: 'd137', name: 'UJAZ JAZZ', phone: '9747255097', bg: 'B+', initial: 'U' },
  { id: 'd138', name: 'VISHNU', phone: '9539700566', bg: 'O+', initial: 'V' },
  { id: 'd139', name: 'LENIN', phone: '9746304037', bg: 'A+', initial: 'L' },
  { id: 'd140', name: 'SAJIN', phone: '9567022411', bg: 'A+', initial: 'S' },
  { id: 'd141', name: 'SHAIJU', phone: '9995960053', bg: 'B+', initial: 'S' },
  { id: 'd142', name: 'GOKUL SB', phone: '9567200910', bg: 'O+', initial: 'G' },
  { id: 'd143', name: 'RAFEEK KM', phone: '9061806070', bg: 'A+', initial: 'R' },
  { id: 'd144', name: 'ASHISH', phone: '8893403409', bg: 'A+', initial: 'A' },
  { id: 'd145', name: 'ARUN', phone: '9567131669', bg: 'A+', initial: 'A' },
  { id: 'd146', name: 'SHIYAS', phone: '9995143800', bg: 'B+', initial: 'S' },
  { id: 'd147', name: 'GITHIN GEORGE', phone: '8281935266', bg: 'A+', initial: 'G' },
  { id: 'd148', name: 'MUHAMMED FAZIL', phone: '9747701512', bg: 'O-', initial: 'M' },
  { id: 'd149', name: 'KICHU S NAIR', phone: '9048603352', bg: 'AB+', initial: 'K' },
  { id: 'd150', name: 'ABDU', phone: '9656696351', bg: 'O-', initial: 'A' },
  { id: 'd151', name: 'ASLAM C', phone: '8606196554', bg: 'B-', initial: 'A' },
  { id: 'd152', name: 'VIBIN SAMUEL', phone: '9746371332', bg: 'A+', initial: 'V' },
  { id: 'd153', name: 'KISHOR BHAI', phone: '9656441397', bg: 'O+', initial: 'K' },
  { id: 'd154', name: 'MIDHUN KOLLAM', phone: '9544422607', bg: 'O+', initial: 'M' },
  { id: 'd155', name: 'ADITH KOLLAM', phone: '9633588179', bg: 'B+', initial: 'A' },
  { id: 'd156', name: 'SHIHAB ALPY', phone: '9895788522', bg: 'AB+', initial: 'S' },
  { id: 'd157', name: 'MUHAMMED SHAMEEM', phone: '9633201868', bg: 'AB+', initial: 'M' },
  { id: 'd158', name: 'BILAL', phone: '7559905979', bg: 'B-', initial: 'B' },
  { id: 'd159', name: 'MALIKB', phone: '9961421098', bg: 'B+', initial: 'M' },
  { id: 'd160', name: 'RABEEU', phone: '7559967583', bg: 'B+', initial: 'R' },
  { id: 'd161', name: 'MOHAMMED IRFAN', phone: '9656141456', bg: 'B+', initial: 'M' },
  { id: 'd162', name: 'ANOOP', phone: '773632230', bg: 'O+', initial: 'A' },
  { id: 'd163', name: 'AJMAL', phone: '7034319734', bg: 'O+', initial: 'A' },
  { id: 'd164', name: 'RAHUL', phone: '9048594192', bg: 'O+', initial: 'R' },
  { id: 'd165', name: 'ANDREWS', phone: '9539953461', bg: 'B+', initial: 'A' },
  { id: 'd166', name: 'SHIBIN', phone: '8590175262', bg: 'O+', initial: 'S' },
  { id: 'd167', name: 'HISHAM', phone: '9061684531', bg: 'B+', initial: 'H' },
  { id: 'd168', name: 'JIJITH PADMAS', phone: '9947290849', bg: 'O+', initial: 'J' },
  { id: 'd169', name: 'SIDHARTH', phone: '8113845285', bg: 'O+', initial: 'S' },
  { id: 'd170', name: 'AMARNATH', phone: '9645702412', bg: 'AB+', initial: 'A' },
  { id: 'd171', name: 'ABDUL JALEEL', phone: '9539412131', bg: 'O+', initial: 'A' },
  { id: 'd172', name: 'VINEESH', phone: '9446377616', bg: 'AB+', initial: 'V' },
  { id: 'd173', name: 'GOKUL', phone: '9744523451', bg: 'UNKNOWN', initial: 'G' },
  { id: 'd174', name: 'RADHAKRISHNAN', phone: '9995160079', bg: 'B+', initial: 'R' },
  { id: 'd175', name: 'TISSMON CHRY', phone: '9747878824', bg: 'B+', initial: 'T' },
  { id: 'd176', name: 'JIJO THOMAS', phone: '9562940947', bg: 'B+', initial: 'J' }
];

export default function DonorsListScreen({ navigation }) {
  const { showAlert } = useContext(MedicineContext);
  const [donors, setDonors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newBg, setNewBg] = useState('');

  useEffect(() => {
    const loadDonors = async () => {
      const savedDonors = await AsyncStorage.getItem('@vital_sync_donors_full');
      if (savedDonors) {
        setDonors(JSON.parse(savedDonors));
      } else {
        setDonors(STATIC_DONORS);
      }
    };
    loadDonors();
  }, []);

  const handleAddDonor = () => {
    if (!newName.trim() || !newPhone.trim()) {
      showAlert("Missing Info", "Please enter name and phone.", "error");
      return;
    }
    
    const newDonor = {
      id: Date.now().toString(),
      name: newName.trim().toUpperCase(),
      phone: newPhone.trim(),
      bg: newBg.trim().toUpperCase() || 'UNKNOWN',
      initial: newName.trim().charAt(0).toUpperCase()
    };

    const updated = [newDonor, ...donors];
    setDonors(updated);
    AsyncStorage.setItem('@vital_sync_donors_full', JSON.stringify(updated));
    setModalVisible(false);
    
    // 🛑 TRIGGER CLOUD BACKUP
    if (auth.currentUser) backupDataToCloud(auth.currentUser.uid);

    setNewName(''); setNewPhone(''); setNewBg('');
    showAlert("Added", `${newDonor.name} is now in the directory.`, "success");
  };

  const handleDeleteDonor = (id, name) => {
    showAlert("Remove Donor", `Remove ${name}?`, "error", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
          const updated = donors.filter(d => d.id !== id);
          setDonors(updated);
          AsyncStorage.setItem('@vital_sync_donors_full', JSON.stringify(updated));
          
          // 🛑 TRIGGER CLOUD BACKUP
          if (auth.currentUser) backupDataToCloud(auth.currentUser.uid);
      }}
    ]);
  };

  // 1. FILTER the donors first
  // 2. SORT the filtered list alphabetically using localeCompare
  const filteredAndSortedDonors = donors
    .filter(d => 
      d.name.includes(searchQuery.toUpperCase()) || 
      d.bg.includes(searchQuery.toUpperCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Donors Directory</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color="#8E8E93" style={{marginRight: 10}} />
        <TextInput 
          style={styles.searchInput} 
          placeholder="Search by Name, District, or Blood Group" 
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList 
        data={filteredAndSortedDonors} // NOW USING THE ALPHABETIZED LIST
        keyExtractor={item => item.id}
        contentContainerStyle={{padding: 20, paddingBottom: 100}}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.contactCard}>
            <View style={styles.contactAvatar}>
              <Text style={styles.contactAvatarText}>{item.initial}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactRelation}>{item.bg}</Text>
              <Text style={styles.contactPhone}>{item.phone}</Text>
            </View>
            <View style={styles.contactActions}>
              <TouchableOpacity style={styles.actionBtnSoft} onPress={() => Linking.openURL(`tel:${item.phone.replace(/\s/g, '')}`)}>
                <Ionicons name="call" size={18} color="#5E5CE6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtnSoft, {backgroundColor: '#F2F2F7'}]} onPress={() => handleDeleteDonor(item.id, item.name)}>
                <Ionicons name="trash" size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* ADD DONOR MODAL */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Blood Donor</Text>
            <TextInput style={styles.modalInput} placeholder="Name" value={newName} onChangeText={setNewName} autoCapitalize="characters" />
            <TextInput style={styles.modalInput} placeholder="Blood Group (e.g. O+)" value={newBg} onChangeText={setNewBg} autoCapitalize="characters" />
            <TextInput style={styles.modalInput} placeholder="Phone Number" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalAddBtn} onPress={handleAddDonor}><Text style={styles.modalAddText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  iconButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 , marginTop: -20},
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 20, paddingHorizontal: 15, height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  searchInput: { flex: 1, fontSize: 15 },
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F4F7FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  contactAvatarText: { color: '#5E5CE6', fontSize: 18, fontWeight: '800' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  contactRelation: { fontSize: 14, color: '#FF3B30', fontWeight: '800', marginBottom: 2 },
  contactPhone: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  contactActions: { flexDirection: 'row' },
  actionBtnSoft: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EAEBFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, width: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20 },
  modalInput: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 15, backgroundColor: '#F9F9FB' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F2F2F7', alignItems: 'center' },
  modalCancelText: { color: '#8E8E93', fontWeight: '600', fontSize: 16 },
  modalAddBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FF3B30', alignItems: 'center' },
  modalAddText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 }
});