Product and Article Workflow Requirement
1. Adding Product
The workflow will start when a Linker adds a new product into the system.
While adding a product, the Linker must first select the Product Type:
Nutra
Ecom
Based on the selected Product Type, the system will display only the sites belonging to that type.
After selecting the site, the Linker will add the following product details:
Product Name
Category (from the categories available for the selected site)
Trend Link
Remarks (Optional)
Preview Link
Product Added Date will be automatically recorded by the system when the product is created.
Product Added By will be automatically recorded based on the logged-in Linker.
Every site will maintain its own category list, which will be managed by the Admin Department.
Once the product is added, it will automatically become visible under the selected category across all sites that belong to the same Product Type, either Nutra or Ecom.
Writers will only be able to view products from the sites for which they have access or have been assigned by the Admin Department.
Within those accessible sites, the product will appear under its relevant category.

2. Writing Article
After the product becomes visible, an eligible Writer can select the product and start working on the article.
A Writer can change the Article Status from Pending to:
In Progress
Every time the Article Status is changed, the system will automatically update the Writer Name and Article Updated Date based on the logged-in Writer.
When the Article Status is changed to In Progress, the backend will automatically record the article start time.
Before changing the Article Status to Completed, the Writer must provide the Article Link.
Once the Article Link is added or changed, and the Article Status is changed to Completed, the system will automatically add the Product Created At Date.
When the Article Status is changed from In Progress to Completed, the backend will automatically calculate the total time taken by the Writer. The time taken will be calculated from the In Progress start time to the Completed time. 
The calculated writing time will be stored in the system for reporting and performance tracking. 
A Writer cannot start working on another product while they have an article that is not yet marked as Completed.
In special cases, a Writer can request approval from the Team Lead to mark the Article Status as Completed without adding the Article Link. 
The system should record the following details for this special approval:
Approved By
Approval Date
Approval Reason
Writer Name
Product Name
This approval exception should be stored for admin review and future tracking.

Workflow Sequence
Linker adds product → Selects Product Type → Enters Product Name → Selects Category → Enters Trend Link → Enters Remarks, if needed → Enters Preview Link → Product is created → Product appears under the same category across all relevant sites of that Product Type → Eligible Writers access the product from authorized sites → Writer starts the article → Article Status changes to In Progress → Backend records article start time → Writer Name and Article Updated Date are updated → Writer adds Article Link → Writer marks article as Completed → Backend records completed time → Backend calculates total writing time → Product Created At Date is automatically added → Writer becomes eligible to work on another product.
Special case:
Writer requests Team Lead approval → Team Lead approves completion without Article Link → Article Status is changed to Completed → Approval details are stored → Backend calculates writing time → Writer becomes eligible to work on another product. 
3. Adding Links
After a product is added into the system, the Linker can open the product and start adding link-related details.
The Linker will select the product for which the link needs to be added or updated.
A single product can have multiple links based on different affiliate networks, GEOs, or link requirements.
The system must support the following link cases:
One link for one GEO
One link for multiple GEOs
Multiple links for different GEOs
Multiple links for the same product from different Affiliate Names
While adding a link, the Linker will add the following details:
Bridge Page Link
Buy Link
Affiliate Names
GEO, with multi-select option
Affiliate Links
Link Status
Linker Remarks, if needed
The GEO field should support multi-select so the Linker can assign one affiliate link to multiple GEOs if needed.
The system should also allow the Linker to add multiple affiliate links under the same product.
Each added affiliate link will be stored as a separate Link Log entry connected to that product.
The Linker Name will be automatically recorded by the system based on the logged-in Linker.
Link Added Date will be automatically recorded when the Linker adds the link details.
The Bridge Page Link must be added before the Buy Link or Affiliate Link can be considered valid.
If the Bridge Page Link is empty, the system must not allow the Linker to change the Link Status to Accepted.
The Linker can change the Link Status to:
Requested
Accepted
Canceled
Issue
Need to check in future
Presell page
Redirected
If the Link Status is changed, the system will automatically update the Link Updated Date.
Linkers and Admins can view, add, edit, and update all Link Log records.
Writers will not have access to the Link Log section unless allowed separately by the Admin Department.
Admin can review bridge page links, buy links, affiliate names, GEOs, affiliate links, link statuses, and linker remarks.
If the Link is not implemented it shows as an Alert in Linkers Dashboard
The link workflow will follow this sequence:
Linker selects product → Adds Bridge Page Link → Adds Buy Link → Selects Affiliate Name → Selects one or multiple GEOs → Adds Affiliate Link → Adds another link if needed → Selects Link Status → Adds Linker Remarks, if needed → Link details are saved → Link Added Date and Linker Name are automatically recorded → Link Log is created or updated → Admin can review the link details.
4. Team Lead Review and Approval
The system will include a Team Lead role for article review, approval, special case approval, and issue communication.
Team Leads can access all sites added in the system.
Team Leads can view all products, article records, writer updates, linker details, and article progress across all sites.
After a Writer marks an article as ready or completed, the Team Lead can review the article.
The Team Lead can approve the article if the work is correct.
If the article needs changes, the Team Lead can add suggestions or remarks for the Writer.
When suggestions are added, the system will send a notification alert to the relevant Writer.
Team Leads can approve special case scenarios where a Writer needs to change Article Status from In Progress to Completed without adding the Article Link.
In this special case, the Team Lead must provide an approval reason before allowing the status change.
Once special approval is given, the system will allow the Writer to mark the article as Completed without the Article Link.
The system will record special approval details, including:
Approved By
Approval Date
Approval Reason
Writer Name
Product Name
Team Leads can also pass messages to Linkers if a link is dead, not implemented, incorrect, or needs checking.
When the Team Lead sends a linker-related message, the system will show it as a notification alert to the relevant Linker.
If the issue is related to article changes, the notification will be sent to the relevant Writer.
If the issue is related to link changes, dead links, bridge page issues, buy link issues, or affiliate link issues, the notification will be sent to the relevant Linker.
Team Lead actions should be stored in the system for tracking and future review.
The Team Lead workflow will follow this sequence:
Team Lead accesses all sites → Reviews article or link-related work → Approves article or suggests changes → Sends notification to relevant Writer or Linker → Approves special completion case if needed → System records approval, remarks, and notification history.


