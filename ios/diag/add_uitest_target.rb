# DIAG, branch diag/ipad-zoom only. Adds the standalone UI test target
# KFZoomUITests and a shared scheme KFZoom to ios/App/App.xcodeproj, in the
# runner's checkout only (the workflow never commits the result).
#
# Standalone: no target application and no dependency on App, and a universal
# device family, so the test runner is a native app on the iPad while the app
# under test (installed by simctl, iPhone-only) runs in compatibility mode.
require 'xcodeproj'

proj_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(proj_path)
abort('the App target is missing') unless project.targets.any? { |t| t.name == 'App' }
abort('KFZoomUITests already exists') if project.targets.any? { |t| t.name == 'KFZoomUITests' }

target = project.new_target(:ui_test_bundle, 'KFZoomUITests', :ios, '15.0')
group = project.main_group.new_group('KFZoomUITests', 'KFZoomUITests')
target.add_file_references([group.new_reference('KFZoomUITests.swift')])
target.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.knowflow.diag.KFZoomUITests'
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  s['SDKROOT'] = 'iphoneos'
  s.delete('TEST_TARGET_NAME')
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(proj_path, 'KFZoom', true)

puts "added #{target.name} (#{target.product_type}); scheme KFZoom"
puts project.targets.map(&:name).inspect
