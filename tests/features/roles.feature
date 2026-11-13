@roles
Feature: Staff users and what each role may do
  The staff settings list the users by role, and the admin offers each
  role its own screens, posts and buttons.

  @critical
  Scenario: The staff settings list the users by role
    Given I am logged in to the admin as "owner"
    Then I should see the staff user "Olivia Owner" with the role "Owner"
    And I should see the staff user "Adam Administrator" with the role "Administrator"
    And I should see the staff user "Edith Editor" with the role "Editor"
    And I should see the staff user "Arthur Author" with the role "Author"
    And I should see the staff user "Connie Contributor" with the role "Contributor"
    And I should not see the staff user "Arthur Author" with the role "Editor"

  Scenario: A staff profile shows the account
    Given I am logged in to the admin as "owner"
    When I open the staff user "Arthur Author"
    Then the staff user email should be "author@example.com"
    And the staff user role should be "Author"
    And the staff user full name should be "Arthur Author"
    And the staff user slug should be "arthur"
    When I close the staff user
    Then I should be on the admin screen "Staff"

  Scenario: The owner may invite any role, and sends nothing by looking
    Given I am logged in to the admin as "owner"
    Then the staff invitation should offer the role "Contributor"
    And the staff invitation should offer the role "Author"
    And the staff invitation should offer the role "Editor"
    And the staff invitation should offer the role "Administrator"
    And I should see the dialog "Invite a new staff user"
    When I answer the dialog with "Close"
    Then I should not see the dialog "Invite a new staff user"

  Scenario: An administrator reaches the settings
    Given I am logged in to the admin as "administrator"
    Then I should see "Settings" in the admin menu
    And I should see "Members" in the admin menu
    When I go to the admin screen "Settings"
    Then the settings section "Title & description" should show "Test site"

  Scenario: An editor sees every post and may publish
    Given I am logged in to the admin as "editor"
    When I go to the admin screen "Posts"
    Then I should see the post "A draft by the author" in the list
    And I should see the post "A draft by the contributor" in the list
    When I open the editor of the post "A draft by the contributor"
    Then the editor should offer "Publish"
    And the post settings should offer "Tags"
    And the post settings should offer "Post access"
    And the post settings should offer "Authors"

  Scenario: An author sees and publishes their own posts only
    Given I am logged in to the admin as "author"
    When I go to the admin screen "Posts"
    Then the list should have 7 posts
    And I should see the post "A draft by the author" in the list
    And I should see the post "A guide to writing" in the list
    And I should not see the post "Welcome to the test site" in the list
    And I should not see the post "A draft by the contributor" in the list
    When I open the editor of the post "A draft by the author"
    Then the editor should offer "Publish"
    And the post settings should offer "Tags"
    And the post settings should not offer "Post access"
    And the post settings should not offer "Authors"

  Scenario: An author has no tags, members and settings screens
    Given I am logged in to the admin as "author"
    Then I should see "Posts" in the admin menu
    And I should not see "Tags" in the admin menu
    And I should not see "Members" in the admin menu
    And I should not see "Settings" in the admin menu
    And the admin screen "Tags" should not be available
    And the admin screen "Members" should not be available
    And the admin screen "Settings" should not be available
    And the admin screen "Staff" should not be available

  Scenario: An author reaches their own post from the search of the admin
    Given I am logged in to the admin as "author"
    When I search the admin for "guide to writing"
    Then I should see the admin search result "A guide to writing"
    When I open the admin search result "A guide to writing"
    Then the editor title should be "A guide to writing"
    And the editor should offer "Update"

  Scenario: A contributor writes drafts and cannot publish
    Given I am logged in to the admin as "contributor"
    When I go to the admin screen "Posts"
    Then the list should have 1 post
    And I should see the post "A draft by the contributor" in the list
    And I should not see the post "Welcome to the test site" in the list
    When I open the editor of the post "A draft by the contributor"
    Then the editor should offer "Preview"
    And the editor should offer "Save"
    And the editor should not offer "Publish"
    And the post settings should offer "Excerpt"
    And the post settings should not offer "Tags"
    And the post settings should not offer "Post access"

  Scenario: A contributor has no tags, members and settings screens
    Given I am logged in to the admin as "contributor"
    Then the admin screen "Tags" should not be available
    And the admin screen "Members" should not be available
    And the admin screen "Settings" should not be available

  Scenario: A contributor saves a new draft and deletes it
    Given I am logged in to the admin as "contributor"
    When I start a new post
    And I set the editor title to "A draft from the suite"
    And I write "A contribution." in the editor
    And I wait for the editor to save
    Then the editor status should be "Draft"
    And the editor should not offer "Publish"
    When I delete the post from the editor
    Then I should not see the post "A draft from the suite" in the list
